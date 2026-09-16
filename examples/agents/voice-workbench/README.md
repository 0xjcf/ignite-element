# Voice and text workbench

Advanced example: one source accepts text or speech, authorizes model-proposed
changes, and projects accepted state to browser, terminal, and speech consumers.
Model setup is optional integration work; it is not required to learn Ignite.

## Run with a local MLX model

From the repository root, run one command:

```bash
pnpm example:voice-workbench
```

The launcher requires macOS on Apple Silicon and `python3`. On its first run it:

1. Creates an isolated environment under
   `~/Library/Caches/ignite-element/voice-workbench/`.
2. Installs the pinned `mlx-lm` package there without changing system Python.
3. Downloads and starts
   [`mlx-community/gemma-4-e4b-it-4bit`](https://huggingface.co/mlx-community/gemma-4-e4b-it-4bit),
   a 5.15 GB quantization whose native tool-call format is parsed by the pinned
   MLX server.
4. Waits only until `/v1/models` proves the endpoint is OpenAI-compatible, then
   starts Vite even if the model is still downloading or loading.
5. Opens the browser in a projected **Preparing local model** state. A minimal
   tool-call probe moves the actor to **Ready** only when MLX can return the
   OpenAI-compatible tool calls this example requires.
6. Keeps both processes attached to the same terminal.

The first run can take several minutes because it installs Python packages and
downloads the model. The UI intentionally loads before that work finishes and
keeps prompt controls disabled; download progress remains visible in the
terminal. Later runs reuse both caches. Press **Control-C** once to stop every
process the launcher owns. If a compatible server is already running on port
8080, the launcher reuses it and does not stop it on exit.

## Code and architecture

See [architecture and validation](architecture-and-validation.md) for the source
machine, typed ports, lifecycle, provider configuration, operational limits,
terminal/headless consumers, and complete validation commands.
