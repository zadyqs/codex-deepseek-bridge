# Provider setup

## DeepSeek V4.1 Flash

The verified bridge runs used the model ID `deepseek-flash` and usually requested reasoning effort `high`; an earlier parent acceptance used `max`. These are recorded profile settings, not a promise about future product names, prices, or quality rankings. Check the provider's current documentation before configuring a new account:

- [Models and pricing](https://api-docs.deepseek.com/quick_start/pricing/)
- [Responses API](https://api-docs.deepseek.com/api/create-response/)
- [Thinking mode](https://api-docs.deepseek.com/guides/thinking_mode/)
- [V4.1 Flash release](https://api-docs.deepseek.com/news/news260910/)

Store the key in `DEEPSEEK_API_KEY`. Do not paste it into this repository or ordinary Codex configuration files.

Add a provider definition to the user's Codex configuration:

```toml
[model_providers.deepseek]
name = "DeepSeek"
base_url = "https://api.deepseek.com/"
env_key = "DEEPSEEK_API_KEY"
wire_api = "responses"
```

Create `%USERPROFILE%\.codex\deepseek.config.toml` on Windows or `~/.codex/deepseek.config.toml` elsewhere:

```toml
model = "deepseek-flash"
model_provider = "deepseek"
model_reasoning_effort = "high"
web_search = "disabled"
```

Validate the profile directly before using the bridge:

```powershell
codex exec --profile deepseek --sandbox read-only --json "Reply with exactly DEEPSEEK_PROFILE_OK"
```

## Other providers

Create a separate Codex profile containing the provider and model pair, then pass the profile name to `run_parallel`. If the provider uses a different credential variable, add only that variable name to `.mcp.json`, rebuild, and reinstall.

Support is not implied by configuration alone. A provider is verified only after a live call returns and the child rollout attests the expected provider and model.

## Desktop model picker

Custom profiles are not currently first-class entries in the Codex Desktop picker. Do not use `model_catalog_json` as an additive catalog: current Desktop behavior can replace the bundled catalog or keep the wrong provider/model pair. Track upstream work in [openai/codex#29156](https://github.com/openai/codex/issues/29156) and [openai/codex#45839](https://github.com/openai/codex/issues/45839).
