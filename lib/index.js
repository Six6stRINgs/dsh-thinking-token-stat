/**
 * Thinking-token statistics surface plugin — node half.
 *
 * Pure UI plugin: the empty `apply` exists so the package appears in the host
 * Loader; the browser half ships via exports["./client"], discovered through
 * the package.json `dsh.client` declaration. All work (reading the
 * conversation snapshot and rendering the dock + turn-tail readouts) happens
 * on the client, so there is no host-side behaviour.
 */

/** Host plugin body — no host-side behavior for this surface plugin. */
export function apply() {}
