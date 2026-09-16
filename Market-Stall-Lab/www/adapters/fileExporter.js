function asBlob(bytes, mimeType) {
  return bytes instanceof Blob ? bytes : new Blob([bytes], { type: mimeType });
}

export async function saveFile({
  name,
  mimeType = 'application/octet-stream',
  bytes,
  nativeAdapter,
  document = globalThis.document,
  urlApi = globalThis.URL
}) {
  if (!name || bytes === undefined) throw new TypeError('name and bytes are required');
  if (nativeAdapter?.saveFile) {
    const saved = await nativeAdapter.saveFile({ name, mimeType, bytes });
    if (!saved?.uri) throw new Error('native file adapter did not confirm a file URI');
    return { ok: true, method: 'native', uri: saved.uri };
  }
  if (!document?.createElement || !urlApi?.createObjectURL) {
    throw new Error('no file export adapter is available');
  }
  const url = urlApi.createObjectURL(asBlob(bytes, mimeType));
  try {
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    link.remove();
    return { ok: true, method: 'download', name };
  } finally {
    urlApi.revokeObjectURL(url);
  }
}
