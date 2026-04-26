import base64
import json
import io
from urllib import request as urlrequest
from urllib.error import HTTPError, URLError

from django.conf import settings
from PIL import Image

_LOCAL_PIPELINE_CACHE = {}


def _encode_pil_image(image, fmt="PNG"):
    buffer = io.BytesIO()
    image.save(buffer, format=fmt)
    return {
        "mime_type": "image/png" if fmt.upper() == "PNG" else "image/jpeg",
        "data": base64.b64encode(buffer.getvalue()).decode("utf-8"),
    }


def _load_local_pipeline(model_key):
    if model_key in _LOCAL_PIPELINE_CACHE:
        return _LOCAL_PIPELINE_CACHE[model_key]
    try:
        import torch
        from diffusers import (
            StableDiffusionPipeline,
            StableDiffusionXLPipeline,
            StableDiffusionImg2ImgPipeline,
            StableDiffusionXLImg2ImgPipeline,
        )
    except Exception as exc:
        raise RuntimeError(
            "Local Stable Diffusion dependencies missing. Install: diffusers transformers accelerate torch safetensors."
        ) from exc

    torch_dtype = torch.float16 if torch.cuda.is_available() else torch.float32
    device = "cuda" if torch.cuda.is_available() else "cpu"

    if model_key == "local-sd15":
        model_id = getattr(settings, "LOCAL_SD15_MODEL_ID", "runwayml/stable-diffusion-v1-5")
        pipeline = StableDiffusionPipeline.from_pretrained(model_id, torch_dtype=torch_dtype)
    elif model_key == "local-sd15-img2img":
        model_id = getattr(settings, "LOCAL_SD15_MODEL_ID", "runwayml/stable-diffusion-v1-5")
        pipeline = StableDiffusionImg2ImgPipeline.from_pretrained(model_id, torch_dtype=torch_dtype)
    elif model_key == "local-sdxl":
        model_id = getattr(settings, "LOCAL_SDXL_MODEL_ID", "stabilityai/stable-diffusion-xl-base-1.0")
        pipeline = StableDiffusionXLPipeline.from_pretrained(model_id, torch_dtype=torch_dtype)
    elif model_key == "local-sdxl-img2img":
        model_id = getattr(settings, "LOCAL_SDXL_MODEL_ID", "stabilityai/stable-diffusion-xl-base-1.0")
        pipeline = StableDiffusionXLImg2ImgPipeline.from_pretrained(model_id, torch_dtype=torch_dtype)
    else:
        raise RuntimeError(f"Unsupported local model key: {model_key}")

    pipeline = pipeline.to(device)
    _LOCAL_PIPELINE_CACHE[model_key] = pipeline
    return pipeline


def _generate_image_with_local_sd(prompt, model, width, height):
    pipeline = _load_local_pipeline(model)
    result = pipeline(
        prompt=prompt,
        width=width,
        height=height,
        num_inference_steps=28,
        guidance_scale=7.5,
    )
    if not result.images:
        raise RuntimeError("No images returned by local model")
    return [_encode_pil_image(result.images[0], fmt="PNG")]


def _decode_input_image(input_image, width, height):
    image_bytes = base64.b64decode(input_image["data"])
    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    return image.resize((width, height))


def _edit_image_with_local_sd(prompt, model, width, height, input_image):
    if not input_image:
        raise RuntimeError("Input image is required for local img2img")

    if model == "local-sd15":
        pipeline = _load_local_pipeline("local-sd15-img2img")
    elif model == "local-sdxl":
        pipeline = _load_local_pipeline("local-sdxl-img2img")
    else:
        raise RuntimeError(f"Unsupported local edit model: {model}")

    init_image = _decode_input_image(input_image, width, height)
    result = pipeline(
        prompt=prompt,
        image=init_image,
        strength=float(getattr(settings, "LOCAL_IMG2IMG_STRENGTH", 0.55)),
        guidance_scale=7.5,
        num_inference_steps=30,
    )
    if not result.images:
        raise RuntimeError("No images returned by local img2img model")
    return [_encode_pil_image(result.images[0], fmt="PNG")]


def get_supported_image_models():
    configured = []
    if getattr(settings, "GEMINI_API_KEY", ""):
        configured.extend(
            [
                {
                    "id": "gemini-2.0-flash-exp-image-generation",
                    "label": "Gemini 2.0 Flash Image Generation",
                    "provider": "google",
                    "supports_generate": True,
                    "supports_edit": False,
                },
                {
                    "id": "gemini-2.5-flash-image-preview",
                    "label": "Gemini 2.5 Flash Image Preview",
                    "provider": "google",
                    "supports_generate": True,
                    "supports_edit": True,
                },
            ]
        )
    if getattr(settings, "ENABLE_LOCAL_SD15", True):
        configured.append(
            {
                "id": "local-sd15",
                "label": "Stable Diffusion 1.5 (Local)",
                "provider": "local",
                "supports_generate": True,
                "supports_edit": True,
            }
        )
    if getattr(settings, "ENABLE_LOCAL_SDXL", True):
        configured.append(
            {
                "id": "local-sdxl",
                "label": "Stable Diffusion XL (Local)",
                "provider": "local",
                "supports_generate": True,
                "supports_edit": True,
            }
        )
    return configured


def _extract_generated_images(response_data):
    images = []
    candidates = response_data.get("candidates", [])
    for candidate in candidates:
        content = candidate.get("content", {})
        parts = content.get("parts", [])
        for part in parts:
            inline_data = part.get("inlineData") or part.get("inline_data")
            if inline_data and inline_data.get("data"):
                images.append(
                    {
                        "mime_type": inline_data.get("mimeType")
                        or inline_data.get("mime_type")
                        or "image/png",
                        "data": inline_data.get("data"),
                    }
                )
    return images


def generate_image_with_gemini(prompt, model, width, height, input_image=None):
    api_key = getattr(settings, "GEMINI_API_KEY", "")
    if not api_key:
        raise ValueError("GEMINI_API_KEY is not configured")

    generation_prompt = (
        f"{prompt}\n\nGenerate image with target resolution {width}x{height}."
    )
    parts = [{"text": generation_prompt}]

    if input_image:
        parts.append(
            {
                "inlineData": {
                    "mimeType": input_image["mime_type"],
                    "data": input_image["data"],
                }
            }
        )

    payload = {
        "contents": [{"parts": parts}],
        "generationConfig": {"responseModalities": ["TEXT", "IMAGE"]},
    }

    endpoint = (
        f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
        f"?key={api_key}"
    )
    req = urlrequest.Request(
        endpoint,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urlrequest.urlopen(req, timeout=120) as resp:
            body = resp.read().decode("utf-8")
            parsed = json.loads(body)
    except HTTPError as exc:
        error_body = exc.read().decode("utf-8") if hasattr(exc, "read") else str(exc)
        raise RuntimeError(f"Gemini API error: {error_body}") from exc
    except URLError as exc:
        raise RuntimeError(f"Gemini request failed: {exc}") from exc

    images = _extract_generated_images(parsed)
    if not images:
        raise RuntimeError("No images returned by Gemini model")
    return images


def generate_image(prompt, model, width, height, input_image=None):
    if model.startswith("gemini-"):
        return generate_image_with_gemini(prompt, model, width, height, input_image=input_image)
    if model in {"local-sd15", "local-sdxl"}:
        if input_image:
            return _edit_image_with_local_sd(prompt, model, width, height, input_image)
        return _generate_image_with_local_sd(prompt, model, width, height)
    raise RuntimeError(f"Unsupported model: {model}")
