#!/usr/bin/env python3
"""
Generate embeddings for context chunks using snowflake-arctic-embed-m from HuggingFace.
Run at build time to create static embeddings.json for the chat widget.

Usage:
    conda activate embeddings
    python scripts/generate-embeddings.py

Requirements:
    conda env with sentence-transformers installed
"""

import json
import os
import sys
from pathlib import Path

try:
    from sentence_transformers import SentenceTransformer
except ImportError as e:
    print(f"Error importing sentence-transformers: {e}")
    print("Run: pip install requests sentence-transformers")
    sys.exit(1)


# Model config - medium model with 768 dims, matches WebLLM's snowflake-arctic-embed-m
MODEL_NAME = "Snowflake/snowflake-arctic-embed-m"


def load_chunks():
    """Load chunk data from JSON env var or local file."""
    # Try environment variable first (CI), then local file
    if os.environ.get('CONTEXT_CHUNKS'):
        print("Loading chunks from CONTEXT_CHUNKS env var")
        data = json.loads(os.environ['CONTEXT_CHUNKS'])
        return data.get('chunks', [])

    # Try local JSON file
    script_dir = Path(__file__).parent
    local_json = script_dir.parent / 'context-chunks.json'
    if local_json.exists():
        print(f"Loading chunks from {local_json}")
        data = json.loads(local_json.read_text())
        return data.get('chunks', [])

    return []


def main():
    # Paths
    script_dir = Path(__file__).parent
    project_root = script_dir.parent
    output_path = project_root / 'assets' / 'data' / 'embeddings.json'

    # Ensure output directory exists
    output_path.parent.mkdir(parents=True, exist_ok=True)

    # Load chunks from JSON
    chunks = load_chunks()
    print(f"Found {len(chunks)} chunks")

    if not chunks:
        print("Error: No chunks found!")
        sys.exit(1)

    # Load model from HuggingFace
    print(f"Loading {MODEL_NAME} from HuggingFace...")
    print("(First run will download ~500MB)")
    model = SentenceTransformer(MODEL_NAME)

    # Generate embeddings
    print("Generating embeddings...")
    contents = [chunk['content'] for chunk in chunks]
    embeddings = model.encode(contents, show_progress_bar=True, normalize_embeddings=True)

    dims = embeddings.shape[1]
    print(f"Model produces {dims}-dimensional embeddings")

    # Build output
    output = {
        'model': 'snowflake-arctic-embed-m',
        'dimensions': dims,
        'chunks': []
    }

    for i, chunk in enumerate(chunks):
        output['chunks'].append({
            'id': chunk['id'],
            'category': chunk['category'],
            'content': chunk['content'],
            'embedding': embeddings[i].tolist()
        })

    # Write output
    print(f"Writing embeddings to {output_path}...")
    with open(output_path, 'w') as f:
        json.dump(output, f)  # No indent to save space

    # Stats
    file_size = output_path.stat().st_size / 1024
    print(f"\nDone! Generated {len(chunks)} embeddings ({dims} dims each)")
    print(f"Output file: {output_path} ({file_size:.1f} KB)")


if __name__ == '__main__':
    main()
