// The Chromium launch options of the gate (known defect 69, SHG-095).
//
// A browser that resolves its proxy by auto-detection waits for that detection before the first request of every new context: about 21 s
// on a machine whose network offers no proxy script (measured on the default device, 2026-11-14: 21.1 to 22.3 s to commit the first
// navigation of a second context, 11 ms with `--no-proxy-server`). The gate opens a context per size, theme and language, so each paid it,
// and a product's browser check with a 30 s navigation timeout failed intermittently (CAOS_ChancaDEM). A target on the loopback (the gate's
// own server under `--serve`, or a `--url` on localhost) is reached with no proxy; a remote `--url` keeps the machine's proxy resolution,
// which a network behind a proxy needs.

/** True when the URL's host is the loopback: `localhost`, an IPv4 address in 127.0.0.0/8, or `[::1]`. */
export function isLoopback(url) {
  const host = new URL(url).hostname.toLowerCase();
  return host === 'localhost' || host.endsWith('.localhost') || host === '[::1]' || /^127(?:\.\d{1,3}){3}$/.test(host);
}

/** The options `chromium.launch` takes for a gate run on `base`. */
export function launchOptions(base) {
  return isLoopback(base) ? { args: ['--no-proxy-server'] } : {};
}
