export function parseTagDraft(draft) {
  return [...new Set(draft.split(",").map(value =>
    value.trim().replace(/\s+/g, " ").toLowerCase().normalize("NFC")
  ).filter(Boolean))];
}

// The studio editors use the same conditional write so another staff member's changes
// are visible before a conflicting edit is retried.
export async function savePhotoTags(editor, photo, tags, signal) {
  const response = await fetch(editor.url, {
    method: "POST",
    headers: { Authorization: `Bearer ${editor.token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ id: photo.id, previousTags: photo.tags || [], tags }),
    signal,
  });
  if (response.status === 401 || response.status === 403) {
    editor.onAuthorizationError();
    return { signedOut: true };
  }
  if (!response.ok && response.status !== 409) throw new Error("Tags konnten nicht gespeichert werden.");
  const body = await response.json();
  return { tags: body.tags, conflict: response.status === 409 };
}
