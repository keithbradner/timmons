#!/bin/bash
# Download RMBG-2.0 model for local use
#
# Usage: HF_TOKEN=your_token ./scripts/download-rmbg.sh
#
# First, accept the license at: https://huggingface.co/briaai/RMBG-2.0
# Get your token at: https://huggingface.co/settings/tokens

set -e

if [ -z "$HF_TOKEN" ]; then
    echo "Error: HF_TOKEN environment variable not set"
    echo "Usage: HF_TOKEN=your_token ./scripts/download-rmbg.sh"
    exit 1
fi

MODEL_DIR="public/models/RMBG-2.0"
BASE_URL="https://huggingface.co/briaai/RMBG-2.0/resolve/main"

mkdir -p "$MODEL_DIR/onnx"

echo "Downloading RMBG-2.0 model files..."

# Download config files
curl -L -H "Authorization: Bearer $HF_TOKEN" \
    "$BASE_URL/config.json" -o "$MODEL_DIR/config.json"
echo "Downloaded config.json"

curl -L -H "Authorization: Bearer $HF_TOKEN" \
    "$BASE_URL/preprocessor_config.json" -o "$MODEL_DIR/preprocessor_config.json"
echo "Downloaded preprocessor_config.json"

# Download ONNX model (quantized - smallest, fastest on CPU)
echo "Downloading ONNX model (quantized, ~175MB)..."
curl -L -H "Authorization: Bearer $HF_TOKEN" \
    "$BASE_URL/onnx/model_quantized.onnx" -o "$MODEL_DIR/onnx/model_quantized.onnx"
echo "Downloaded onnx/model_quantized.onnx"

echo ""
echo "Done! Model files saved to $MODEL_DIR"
ls -lh "$MODEL_DIR"
ls -lh "$MODEL_DIR/onnx"
