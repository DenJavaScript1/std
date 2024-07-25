// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
/**
 * Gets the IPv4 or IPv6 network address of the machine.
 *
 * > [!WARNING]
 * > **UNSTABLE**: New API, yet to be vetted.
 *
 * This is inspired by the util of the same name in
 * {@linkcode https://www.npmjs.com/package/serve | npm:serve}.
 *
 * For more advanced use, use {@linkcode Deno.networkInterfaces} directly.
 *
 * @see {@link https://github.com/vercel/serve/blob/1ea55b1b5004f468159b54775e4fb3090fedbb2b/source/utilities/http.ts#L33}
 *
 * @param family The IP protocol version of the interface to get the address of.
 * @returns The IPv4 network address of the machine or `undefined` if not found.
 *
 * @example
 * <caption>Get the IPv4 network address (default)</caption>

 * ```ts no-assert no-eval
 * import { getNetworkAddress } from "@std/net/get-network-address";
 *
 * const hostname = getNetworkAddress();
 *
 * Deno.serve({ port: 0, hostname }, () => new Response("Hello, world!"));
 * ```
 *
 * @example
 * <caption>Get the IPv6 network address</caption>

 * ```ts no-assert no-eval
 * import { getNetworkAddress } from "@std/net/get-network-address";
 *
 * const hostname = getNetworkAddress("IPv6");
 *
 * Deno.serve({ port: 0, hostname }, () => new Response("Hello, world!"));
 * ```
 *
 * @experimental
 */
export function getNetworkAddress(
  family: Deno.NetworkInterfaceInfo["family"] = "IPv4",
): string | undefined {
  return Deno.networkInterfaces()
    .find((i) =>
      i.family === family &&
      (family === "IPv4"
        // Cannot lie within 127.0.0.0/8
        ? !i.address.startsWith("127")
        // Cannot be loopback or link-local addresses
        : !(i.address === "::1" || i.address === "fe80::1") && i.scopeid === 0)
    )
    ?.address;
}
