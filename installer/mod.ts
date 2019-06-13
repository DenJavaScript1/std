#!/usr/bin/env deno --allow-all

const {
  args,
  env,
  readDirSync,
  mkdirSync,
  writeFile,
  exit,
  readAll,
  stdin,
  stat,
  run
} = Deno;
import * as path from "../fs/path.ts";
import { parse as parseShebang } from "./shebang.ts";

const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8");

enum Permission {
  Unknown,
  Read,
  Write,
  Net,
  Env,
  Run,
  All
}

function getPermissionFromFlag(flag: string): Permission {
  switch (flag) {
    case "--allow-read":
      return Permission.Read;
    case "--allow-write":
      return Permission.Write;
    case "--allow-net":
      return Permission.Net;
    case "--allow-env":
      return Permission.Env;
    case "--allow-run":
      return Permission.Run;
    case "--allow-all":
      return Permission.All;
    case "-A":
      return Permission.All;
  }
  return Permission.Unknown;
}

function getFlagFromPermission(perm: Permission): string {
  switch (perm) {
    case Permission.Read:
      return "--allow-read";
    case Permission.Write:
      return "--allow-write";
    case Permission.Net:
      return "--allow-net";
    case Permission.Env:
      return "--allow-env";
    case Permission.Run:
      return "--allow-run";
    case Permission.All:
      return "--allow-all";
  }
  return "";
}

async function readCharacter(): Promise<string> {
  const byteArray = new Uint8Array(1024);
  await stdin.read(byteArray);
  const line = decoder.decode(byteArray);
  return line[0];
}

async function yesNoPrompt(message: string): Promise<boolean> {
  console.log(`${message} [yN]`);
  const input = await readCharacter();
  console.log();
  return input === "y" || input === "Y";
}

function createDirIfNotExists(path: string): void {
  try {
    readDirSync(path);
  } catch (e) {
    mkdirSync(path);
  }
}

function getInstallerDir(): string {
  const { HOME } = env();

  if (!HOME) {
    throw new Error("$HOME is not defined.");
  }

  return path.join(HOME, ".deno", "bin");
}

// TODO: fetch doesn't handle redirects yet - once it does this function
//  can be removed
async function fetchWithRedirects(
  url: string,
  redirectLimit: number = 10
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  // TODO: `Response` is not exposed in global so 'any'
  const response = await fetch(url);

  if (response.status === 301 || response.status === 302) {
    if (redirectLimit > 0) {
      const redirectUrl = response.headers.get("location");
      return await fetchWithRedirects(redirectUrl, redirectLimit - 1);
    }
  }

  return response;
}

function moduleNameFromPath(modulePath: string): string {
  let moduleName = path.basename(modulePath, ".ts");
  moduleName = path.basename(moduleName, ".js");
  return moduleName;
}

async function fetchModule(url: string): Promise<string> {
  const response = await fetchWithRedirects(url);

  if (response.status !== 200) {
    // TODO: show more debug information like status and maybe body
    throw new Error(`Failed to get remote script ${url}.`);
  }

  const body = await readAll(response.body);
  return decoder.decode(body);
}

async function main(): void {
  let installerDir = getInstallerDir();
  createDirIfNotExists(installerDir);

  const moduleUrl: string = args[1];
  // TODO: handle local modules as well
  if (!moduleUrl.startsWith("http")) {
    throw new Error("Only remote modules are supported.");
  }

  const moduleName = moduleNameFromPath(moduleUrl);
  const FILE_PATH = path.join(installerDir, moduleName);

  let fileInfo;
  try {
    fileInfo = await stat(FILE_PATH);
  } catch (e) {
    // pass
  }

  if (fileInfo) {
    const msg = `⚠️  ${moduleName} is already installed, do you want to overwrite it?`;
    if (!(await yesNoPrompt(msg))) {
      return;
    }
  }

  console.log(`Downloading: ${moduleUrl}\n`);
  const moduleText = await fetchModule(moduleUrl);

  const grantedPermissions: Permission[] = [];

  let shebang: { args: string[] } | undefined;

  const line = moduleText.split("\n")[0];

  try {
    shebang = parseShebang(line);
  } catch (e) {}

  if (shebang) {
    const requestedPermissions: Permission[] = [];
    console.log("ℹ️  Detected shebang:\n");
    console.log(`   ${line}\n`);
    console.log("   Requested permissions:\n");

    for (const flag of shebang.args) {
      const permission = getPermissionFromFlag(flag);
      if (permission === Permission.Unknown) {
        continue;
      }

      console.log("\t" + flag);
      requestedPermissions.push(permission);
    }

    console.log();

    if (yesNoPrompt("⚠️  Grant?")) {
      requestedPermissions.forEach(
        (perm: Permission): void => {
          grantedPermissions.push(perm);
        }
      );
    }
  } else {
    for (const flag of args.slice(2)) {
      const permission = getPermissionFromFlag(flag);
      if (permission === Permission.Unknown) {
        continue;
      }
      grantedPermissions.push(permission);
    }
  }

  const commands = [
    "deno",
    ...grantedPermissions.map(getFlagFromPermission),
    moduleUrl,
    "$@"
  ];

  // TODO: add windows Version
  const template = `#/bin/sh\n${commands.join(" ")}`;
  writeFile(FILE_PATH, encoder.encode(template));

  const makeExecutable = run({ args: ["chmod", "+x", FILE_PATH] });
  await makeExecutable.status();
  makeExecutable.close();

  console.log(`✅  Successfully installed ${moduleName}.\n`);
  // TODO: display this prompt only if `installerDir` not in PATH
  // TODO: add Windows version
  console.log("ℹ️  Add ~/.deno/bin to PATH");
  console.log(
    "   echo 'export PATH=\"$HOME/.deno/bin:$PATH\"' >> ~/.bashrc # change this to your shell"
  );
}

// TODO: refactor
try {
  main();
} catch (e) {
  const err = e as Error;
  if (err.message) {
    console.log(err.message);
  } else {
    console.log(e);
  }
  exit(1);
}
