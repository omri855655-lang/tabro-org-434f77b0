import { scrapeAmex, safeAmexFailure } from './amex-adapter.mjs';

process.once('message', async payload => {
  let result;
  try { result = await scrapeAmex(payload.credentials, payload.options); }
  catch { result = safeAmexFailure(); }
  // Credentials never enter command-line arguments, inherited environment,
  // stdout/stderr, files, or an additional network service.
  process.send(result, () => process.exit(0));
});
