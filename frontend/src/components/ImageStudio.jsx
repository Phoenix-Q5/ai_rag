import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  CircularProgress,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from "@mui/material";
import {
  deleteImageHistoryItem,
  generateImage,
  getImageHistory,
  getImageModels,
} from "../api/chat";

const DEFAULT_RESOLUTIONS = [
  { label: "512 x 512", value: "512x512", width: 512, height: 512 },
  { label: "768 x 768", value: "768x768", width: 768, height: 768 },
  { label: "1024 x 1024", value: "1024x1024", width: 1024, height: 1024 },
  { label: "1024 x 1536", value: "1024x1536", width: 1024, height: 1536 },
  { label: "1536 x 1024", value: "1536x1024", width: 1536, height: 1024 },
];

export default function ImageStudio() {
  const [prompt, setPrompt] = useState("");
  const [models, setModels] = useState([]);
  const [operationMode, setOperationMode] = useState("generate");
  const [selectedModel, setSelectedModel] = useState("");
  const [resolution, setResolution] = useState("1024x1024");
  const [uploadedImage, setUploadedImage] = useState(null);
  const [uploadedPreview, setUploadedPreview] = useState("");
  const [uploadedSize, setUploadedSize] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState([]);
  const [historyItems, setHistoryItems] = useState([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyPageSize] = useState(12);
  const [historyHasMore, setHistoryHasMore] = useState(false);
  const [historyTotal, setHistoryTotal] = useState(0);

  useEffect(() => {
    const loadInitialData = async () => {
      const [modelData, historyData] = await Promise.all([
        getImageModels(),
        getImageHistory(historyPage, historyPageSize),
      ]);
      setModels(modelData);
      setHistoryItems(historyData.items || []);
      setHistoryHasMore(Boolean(historyData.has_more));
      setHistoryTotal(historyData.total || 0);
    };
    loadInitialData();
  }, [historyPage, historyPageSize]);

  const refreshHistory = async (page = historyPage) => {
    const historyData = await getImageHistory(page, historyPageSize);
    setHistoryItems(historyData.items || []);
    setHistoryHasMore(Boolean(historyData.has_more));
    setHistoryTotal(historyData.total || 0);
  };

  const filteredModels = useMemo(
    () =>
      models.filter((model) =>
        operationMode === "edit"
          ? Boolean(model.supports_edit)
          : Boolean(model.supports_generate)
      ),
    [models, operationMode]
  );

  useEffect(() => {
    if (!filteredModels.length) {
      setSelectedModel("");
      return;
    }
    const exists = filteredModels.some((model) => model.id === selectedModel);
    if (!exists) {
      setSelectedModel(filteredModels[0].id);
    }
  }, [filteredModels, selectedModel]);

  const resolutionOptions = useMemo(() => {
    const options = [...DEFAULT_RESOLUTIONS];
    if (uploadedSize?.width && uploadedSize?.height) {
      const value = `${uploadedSize.width}x${uploadedSize.height}`;
      options.unshift({
        label: `Uploaded (${uploadedSize.width} x ${uploadedSize.height})`,
        value,
        width: uploadedSize.width,
        height: uploadedSize.height,
      });
    }
    return options;
  }, [uploadedSize]);

  const selectedResolution = useMemo(
    () => resolutionOptions.find((item) => item.value === resolution) || resolutionOptions[0],
    [resolutionOptions, resolution]
  );

  const onUploadImage = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setOperationMode("edit");
    setUploadedImage(file);
    setUploadedPreview(URL.createObjectURL(file));
    const img = new Image();
    img.onload = () => {
      const width = img.naturalWidth || img.width;
      const height = img.naturalHeight || img.height;
      setUploadedSize({ width, height });
      setResolution(`${width}x${height}`);
    };
    img.src = URL.createObjectURL(file);
  };

  const removeUploadedImage = () => {
    setUploadedImage(null);
    setUploadedPreview("");
    setUploadedSize(null);
    setOperationMode("generate");
    setResolution("1024x1024");
  };

  const onGenerate = async () => {
    if (!prompt.trim() || !selectedModel || !selectedResolution) return;
    setIsGenerating(true);
    try {
      const result = await generateImage({
        prompt,
        model: selectedModel,
        width: selectedResolution.width,
        height: selectedResolution.height,
        imageFile: uploadedImage,
      });
      setGeneratedImages(result.images || []);
      setHistoryPage(1);
      await refreshHistory(1);
    } catch (err) {
      console.error("Image generation failed:", err);
      alert(err?.response?.data?.error || "Image generation failed.");
    } finally {
      setIsGenerating(false);
    }
  };

  const onDeleteHistoryItem = async (itemId) => {
    try {
      await deleteImageHistoryItem(itemId);
      const nextPage =
        historyItems.length === 1 && historyPage > 1 ? historyPage - 1 : historyPage;
      setHistoryPage(nextPage);
      await refreshHistory(nextPage);
    } catch (err) {
      console.error("Failed to delete history item:", err);
      alert("Failed to delete history item.");
    }
  };

  const onCopyPrompt = async (text) => {
    try {
      await navigator.clipboard.writeText(text || "");
      alert("Prompt copied.");
    } catch (err) {
      console.error("Failed to copy prompt:", err);
      alert("Copy failed.");
    }
  };

  const onRegenerateFromHistory = (item) => {
    setPrompt(item.prompt || "");
    setOperationMode(item.input_image_url ? "edit" : "generate");
    setResolution(`${item.width}x${item.height}`);
    if (item.input_image_url) {
      setUploadedPreview(item.input_image_url);
      setUploadedSize({ width: item.width, height: item.height });
      setUploadedImage(null);
      alert("Input image from history is previewed. Upload a local image to edit and regenerate.");
    } else {
      removeUploadedImage();
    }
    const modelAvailable = models.some((model) => model.id === item.model);
    if (modelAvailable) {
      setSelectedModel(item.model);
    }
  };

  return (
    <Box flex={1} p={{ xs: 2, md: 3 }} bgcolor="#f8fafc" overflow="auto">
      <Typography variant="h5" fontWeight={700} color="#111827" mb={0.5}>
        Image Studio
      </Typography>
      <Typography variant="body2" color="#6b7280" mb={2}>
        Create or edit images with model selection, history, and downloads.
      </Typography>

      <Box
        display="grid"
        gap={2}
        maxWidth="980px"
        p={{ xs: 1.5, md: 2 }}
        border="1px solid #dbe2ea"
        borderRadius="16px"
        bgcolor="#eef2f7"
      >
        <Box display="flex" gap={1}>
          <Chip
            label="Generate"
            clickable
            color={operationMode === "generate" ? "primary" : "default"}
            onClick={() => setOperationMode("generate")}
          />
          <Chip
            label="Edit"
            clickable
            color={operationMode === "edit" ? "primary" : "default"}
            onClick={() => setOperationMode("edit")}
          />
        </Box>

        <TextField
          multiline
          minRows={3}
          label="Prompt"
          placeholder={
            operationMode === "edit"
              ? "Describe how you want to edit the uploaded image..."
              : "Describe the image you want to generate..."
          }
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          fullWidth
        />

        <Box display="grid" gridTemplateColumns={{ xs: "1fr", md: "minmax(280px,1fr) 220px auto auto" }} gap={1.5}>
          <FormControl sx={{ minWidth: 0 }}>
            <InputLabel id="image-model-label">Model</InputLabel>
            <Select
              labelId="image-model-label"
              value={selectedModel}
              label="Model"
              onChange={(e) => setSelectedModel(e.target.value)}
            >
              {filteredModels.map((model) => (
                <MenuItem key={model.id} value={model.id}>
                  {model.label} {model.supports_edit ? "(Edit)" : "(Generate)"}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl sx={{ minWidth: 0 }}>
            <InputLabel id="resolution-label">Resolution</InputLabel>
            <Select
              labelId="resolution-label"
              value={resolution}
              label="Resolution"
              onChange={(e) => setResolution(e.target.value)}
            >
              {resolutionOptions.map((item) => (
                <MenuItem key={item.value} value={item.value}>
                  {item.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Button
            variant="outlined"
            component="label"
            sx={{ textTransform: "none", height: 56, borderRadius: "10px" }}
          >
            {uploadedImage ? "Replace Image" : "Upload Image (Optional)"}
            <input hidden type="file" accept="image/*" onChange={onUploadImage} />
          </Button>

          <Button
            variant="contained"
            disabled={
              isGenerating ||
              !prompt.trim() ||
              !selectedModel ||
              (operationMode === "edit" && !uploadedImage)
            }
            onClick={onGenerate}
            sx={{ textTransform: "none", height: 56, borderRadius: "10px" }}
          >
            {isGenerating ? (
              <Box display="flex" alignItems="center" gap={1}>
                <CircularProgress size={16} color="inherit" />
                Generating...
              </Box>
            ) : (
              "Generate Image"
            )}
          </Button>
        </Box>
        {operationMode === "edit" && !uploadedImage && (
          <Typography variant="body2" color="#b91c1c">
            Upload an input image to use edit mode.
          </Typography>
        )}

        {uploadedPreview && (
          <Box p={1.5} border="1px solid #d1d5db" borderRadius="12px" bgcolor="#f8fafc">
            <Typography variant="body2" color="#6b7280" mb={1}>
              Input image preview
            </Typography>
            <Button size="small" sx={{ mb: 1, textTransform: "none" }} onClick={removeUploadedImage}>
              Remove uploaded image
            </Button>
            <img
              src={uploadedPreview}
              alt="Uploaded input"
              style={{ maxWidth: "320px", borderRadius: 12, border: "1px solid #d1d5db" }}
            />
          </Box>
        )}

        {generatedImages.length > 0 && (
          <Box p={1.5} border="1px solid #d1d5db" borderRadius="12px" bgcolor="#f8fafc">
            <Typography variant="subtitle1" fontWeight={700} mb={1}>
              Generated Results
            </Typography>
            <Box display="flex" flexWrap="wrap" gap={2}>
              {generatedImages.map((img, idx) => (
                <Box
                  key={`${img.mime_type}-${idx}`}
                  p={1}
                  border="1px solid #dbe2ea"
                  borderRadius="12px"
                  bgcolor="#ffffff"
                >
                  <img
                    src={`data:${img.mime_type};base64,${img.data}`}
                    alt={`Generated ${idx + 1}`}
                    style={{ maxWidth: "360px", borderRadius: 12, border: "1px solid #d1d5db" }}
                  />
                  <Box mt={1}>
                    <Button
                      variant="outlined"
                      size="small"
                      sx={{ textTransform: "none", borderRadius: "8px" }}
                      href={img.download_url || `data:${img.mime_type};base64,${img.data}`}
                      download={`generated-${idx + 1}.png`}
                    >
                      Download
                    </Button>
                  </Box>
                </Box>
              ))}
            </Box>
          </Box>
        )}

        <Box p={1.5} border="1px solid #d1d5db" borderRadius="12px" bgcolor="#f8fafc">
          <Typography variant="subtitle1" fontWeight={700} mb={1}>
            Image History
          </Typography>
          <Typography variant="body2" color="#6b7280" mb={1}>
            {historyTotal} total image(s)
          </Typography>
          <Box display="flex" flexWrap="wrap" gap={2}>
            {historyItems.map((item) => (
              <Box
                key={item.id}
                p={1}
                border="1px solid #dbe2ea"
                borderRadius="12px"
                bgcolor="#ffffff"
                width="240px"
              >
                <img
                  src={item.output_image_url}
                  alt={`History ${item.id}`}
                  style={{ maxWidth: "220px", borderRadius: 12, border: "1px solid #d1d5db" }}
                />
                <Typography variant="caption" display="block" sx={{ mt: 0.5, maxWidth: "220px" }}>
                  {item.model} - {item.width}x{item.height}
                </Typography>
                <Typography
                  variant="caption"
                  display="block"
                  sx={{
                    maxWidth: "220px",
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {item.prompt}
                </Typography>
                <Button
                  variant="outlined"
                  size="small"
                  sx={{ mt: 0.5, textTransform: "none", borderRadius: "8px" }}
                  href={item.output_image_url}
                  download
                >
                  Download
                </Button>
                <Box display="flex" gap={0.8} mt={0.8} flexWrap="wrap">
                  <Button
                    variant="outlined"
                    size="small"
                    sx={{ textTransform: "none", borderRadius: "8px" }}
                    onClick={() => onCopyPrompt(item.prompt)}
                  >
                    Copy Prompt
                  </Button>
                  <Button
                    variant="outlined"
                    size="small"
                    sx={{ textTransform: "none", borderRadius: "8px" }}
                    onClick={() => onRegenerateFromHistory(item)}
                  >
                    Regenerate
                  </Button>
                  <Button
                    variant="outlined"
                    color="error"
                    size="small"
                    sx={{ textTransform: "none", borderRadius: "8px" }}
                    onClick={() => onDeleteHistoryItem(item.id)}
                  >
                    Delete
                  </Button>
                </Box>
              </Box>
            ))}
          </Box>
          <Box display="flex" gap={1} mt={2} alignItems="center">
            <Button
              variant="outlined"
              size="small"
              disabled={historyPage <= 1}
              onClick={() => setHistoryPage((prev) => Math.max(1, prev - 1))}
            >
              Previous
            </Button>
            <Button
              variant="outlined"
              size="small"
              disabled={!historyHasMore}
              onClick={() => setHistoryPage((prev) => prev + 1)}
            >
              Next
            </Button>
            <Typography variant="body2" sx={{ alignSelf: "center" }}>
              Page {historyPage}
            </Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
