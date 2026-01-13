#!/bin/bash
# Download RMBG-1.4 model from Hugging Face CDN
# Used during build on platforms that don't support Git LFS (like Railway)

set -e

MODEL_DIR="public/models/briaai/RMBG-1.4"
ONNX_DIR="$MODEL_DIR/onnx"
ONNX_FILE="$ONNX_DIR/model.onnx"
EXPECTED_SIZE=176153355  # ~176MB

echo "Downloading RMBG-1.4 model for background removal..."

# Create directories
mkdir -p "$ONNX_DIR"

# Check if model.onnx exists and is the right size (not an LFS pointer)
if [ -f "$ONNX_FILE" ]; then
    ACTUAL_SIZE=$(stat -f%z "$ONNX_FILE" 2>/dev/null || stat -c%s "$ONNX_FILE" 2>/dev/null || echo "0")
    if [ "$ACTUAL_SIZE" -gt 1000000 ]; then
        echo "✓ $ONNX_FILE already exists ($ACTUAL_SIZE bytes)"
    else
        echo "Found LFS pointer ($ACTUAL_SIZE bytes), downloading actual model..."
        curl -L --progress-bar -o "$ONNX_FILE" \
            "https://huggingface.co/briaai/RMBG-1.4/resolve/main/onnx/model.onnx"
        echo "✓ Downloaded $ONNX_FILE"
    fi
else
    echo "Downloading model.onnx (~176MB)..."
    curl -L --progress-bar -o "$ONNX_FILE" \
        "https://huggingface.co/briaai/RMBG-1.4/resolve/main/onnx/model.onnx"
    echo "✓ Downloaded $ONNX_FILE"
fi

# Download config files (small, always re-download to ensure fresh)
echo "Downloading config files..."
curl -sL -o "$MODEL_DIR/config.json" \
    "https://huggingface.co/briaai/RMBG-1.4/resolve/main/config.json"
echo "✓ config.json"

curl -sL -o "$MODEL_DIR/preprocessor_config.json" \
    "https://huggingface.co/briaai/RMBG-1.4/resolve/main/preprocessor_config.json"
echo "✓ preprocessor_config.json"

echo ""
echo "Model download complete!"
ls -lh "$ONNX_FILE"
