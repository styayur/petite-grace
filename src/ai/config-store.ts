import type { ProviderConfig } from "./types";
import { DEFAULT_PROVIDER_CONFIGS } from "./providers/registry";
import { providerSecretRepository, settingsRepository } from "../storage/repositories";

const SETTINGS_KEY = "aiProviderConfigs";

export async function loadProviderConfigs(): Promise<ProviderConfig[]> {
  const stored = await settingsRepository.get<ProviderConfig[]>(
    SETTINGS_KEY,
    DEFAULT_PROVIDER_CONFIGS,
  );
  const byId = new Map(stored.map((config) => [config.id, config]));
  const merged = DEFAULT_PROVIDER_CONFIGS.map((defaultConfig) => ({
    ...defaultConfig,
    ...byId.get(defaultConfig.id),
  }));
  for (const extra of stored) {
    if (!merged.some((config) => config.id === extra.id)) merged.push(extra);
  }
  return Promise.all(
    merged.map(async (config) => ({
      ...config,
      apiKey: (await providerSecretRepository.get(config.id)) ?? undefined,
    })),
  );
}

export async function saveProviderConfigs(configs: ProviderConfig[]): Promise<void> {
  const sanitized = configs.map(({ apiKey: _apiKey, ...config }) => config);
  await settingsRepository.put(SETTINGS_KEY, sanitized);
  await Promise.all(
    configs.map(async (config) => {
      if (config.apiKey) {
        await providerSecretRepository.put({
          providerId: config.id,
          apiKey: config.apiKey,
          updatedAt: new Date().toISOString(),
        });
      } else {
        await providerSecretRepository.delete(config.id);
      }
    }),
  );
}
