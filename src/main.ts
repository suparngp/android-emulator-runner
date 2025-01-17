import * as core from '@actions/core';
import { installAndroidSdk } from './sdk-installer';
import { checkApiLevel, checkTarget, checkArch, checkDisableAnimations, checkEmulatorBuild } from './input-validator';
import { launchEmulator, killEmulator } from './emulator-manager';
import * as exec from '@actions/exec';
import { parseScript } from './script-parser';

async function run() {
  try {
    // only support running on macOS
    if (process.platform !== 'darwin') {
      throw new Error('This action is expected to be run within a macOS virtual machine to enable hardware acceleration.');
    }

    // API level of the platform and system image
    const apiLevelInput = core.getInput('api-level', { required: true });
    checkApiLevel(apiLevelInput);
    const apiLevel = Number(apiLevelInput);
    console.log(`API level: ${apiLevel}`);

    // target of the system image
    const target = core.getInput('target');
    checkTarget(target);
    console.log(`target: ${target}`);

    // CPU architecture of the system image
    const arch = core.getInput('arch');
    checkArch(arch);
    console.log(`CPU architecture: ${arch}`);

    // Hardware profile used for creating the AVD
    const profile = core.getInput('profile');
    console.log(`Hardware profile: ${profile}`);

    // emulator options
    const emulatorOptions = core.getInput('emulator-options').trim();
    console.log(`emulator options: ${emulatorOptions}`);

    // disable animations
    const disableAnimationsInput = core.getInput('disable-animations');
    checkDisableAnimations(disableAnimationsInput);
    const disableAnimations = disableAnimationsInput === 'true';
    console.log(`disable animations: ${disableAnimations}`);

    // emulator build
    const emulatorBuildInput = core.getInput('emulator-build');
    if (emulatorBuildInput) {
      checkEmulatorBuild(emulatorBuildInput);
      console.log(`using emulator build: ${emulatorBuildInput}`);
    }
    const emulatorBuild = !emulatorBuildInput ? undefined : emulatorBuildInput;

    // custom script to run
    const scriptInput = core.getInput('script', { required: false });
    const scripts = scriptInput ? parseScript(scriptInput) : [];
    console.log(`Script:`);
    scripts.forEach(async (script: string) => {
      console.log(`${script}`);
    });
    // skip killing emulator
    const keepEmulator = core.getInput('keep') === 'true';
    console.log(`keep emulator: ${keepEmulator}`);

    // install SDK
    await installAndroidSdk(apiLevel, target, arch, emulatorBuild);

    try {
      // launch an emulator
      await launchEmulator(apiLevel, target, arch, profile, emulatorOptions, disableAnimations);
    } catch (error) {
      core.setFailed(error.message);
    }

    // execute the custom script
    try {
      for (const script of scripts) {
        await exec.exec(`${script}`);
      }
    } catch (error) {
      core.setFailed(error.message);
    }

    if (!keepEmulator) {
      await killEmulator();
    } else {
      process.exit(0);
    }
  } catch (error) {
    // kill the emulator so the action can exit
    await killEmulator();
    core.setFailed(error.message);
  }
}

run();
