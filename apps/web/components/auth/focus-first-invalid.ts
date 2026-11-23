/* Puts the cursor on the first field (by id, in page order) that is marked
   invalid, so a failed submit lands the user on the first thing to fix. */
export function focusFirstInvalid(ids: string[]): void {
  for (const id of ids) {
    const el = document.getElementById(id)
    if (el?.getAttribute('aria-invalid') === 'true') {
      el.focus()
      return
    }
  }
}
