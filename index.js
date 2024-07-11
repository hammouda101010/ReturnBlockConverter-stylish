// Created by Miyo.
// https://github.com/yuri-kiss/ReturnBlockConverter
(function() {
  const loadBtn = document.querySelector('button[for="loading zip"]'), dlBtn = document.querySelector('button[for="downloading zip"]');
  loadBtn.setAttribute('disabled', '1');
  dlBtn.setAttribute('disabled', '1');
  const dlOnFinish = false, clearOnFinish = false;
  const project = {
    json: null,
    zip: null,
    target: null,
    isPM: false,
    setTarget(t) {
      if (typeof t === 'string') this.target = this.json.targets.find(target => target.sprite.name === t);
      else if (t.stage) this.target = this.json.targets.find(target => target.isStage);
      else if (Object.hasOwn(t, 'isStage')) this.target = t;
    },
    getBlocksByOpcode(opcode) {
      return Object.entries(this.target.blocks).filter(block => block[1].opcode === opcode);
    },
    getBlock(id) {
      return this.target.blocks[id];
    },
    updateBlock(id, block) {
      delete this.target.blocks[id];
      this.target.blocks[id] = block;
    },
  };
  async function manageBlocks() {
    const returnMap = new Map([
      ['string', 1],
      ['1', '"string"'],
      ['boolean', 2],
      ['2', '"boolean"'],
    ]);
    const returns = project.getBlocksByOpcode('procedures_return');
    for (const ret of returns) {
      const restructuredReturn = structuredClone(ret[1]);
      if (project.isPM) {
        restructuredReturn.inputs.VALUE = structuredClone(restructuredReturn.inputs.return);
        restructuredReturn.inputs.VALUE.name = 'VALUE';
        delete restructuredReturn.inputs.return;
      } else {
        restructuredReturn.inputs.return = structuredClone(restructuredReturn.inputs.VALUE);
        restructuredReturn.inputs.return.name = 'return';
        delete restructuredReturn.inputs.VALUE;
      }
      project.updateBlock(ret[0], restructuredReturn);
    }
    let prototypes = new Set();
    const calls = project.getBlocksByOpcode('procedures_call');
    for (const call of calls) {
      const restructuredCall = structuredClone(call[1]), mutation = restructuredCall.mutation;
      if (project.isPM) {
        if (!mutation.returns) continue;
        prototypes.add(mutation.proccode);
        delete mutation.returns;
        mutation.return = returnMap.get(JSON.parse(mutation.optype));
        delete mutation.optype;
        delete mutation.color;
        if (typeof mutation.return === 'undefined') delete mutation.return;
      } else {
        prototypes.add(mutation.proccode);
        mutation.optype = returnMap.get(String(mutation.return));
        mutation.color = '["#FF6680","#FF4D6A","#FF3355"]';
        mutation.returns = Object.hasOwn(mutation, 'return');
        mutation.edited = true;
        delete mutation.return;
      }
      project.updateBlock(call[0], restructuredCall);
    }
    prototypes = project.getBlocksByOpcode('procedures_prototype').filter(block => prototypes.has(block[1].mutation.proccode));
    for (const proto of prototypes) {
      const restructuredProto = structuredClone(proto[1]);
      const definition = project.getBlock(restructuredProto.parent);
      definition.opcode = 'procedures_definition';
      const mutation = restructuredProto.mutation;
      if (project.isPM) {
        delete mutation.returns;
        mutation.return = returnMap.get(JSON.parse(mutation.optype));
        delete mutation.optype;
        delete mutation.color;
        if (typeof mutation.return === 'undefined') delete mutation.return;
      } else {
        mutation.optype = returnMap.get(String(mutation.return));
        debugger;
        mutation.color = '["#FF6680","#FF4D6A","#FF3355"]';
        mutation.returns = Object.hasOwn(mutation, 'return');
        mutation.edited = true;
        if (mutation.returns) definition.opcode = 'procedures_definition_return';
        delete mutation.return;
      }
      project.updateBlock(proto[0], restructuredProto);
      project.updateBlock(restructuredProto.parent, definition);
    }
  }
  async function convertProject() {
    const platform = project.json.meta.platform, platName = platform.name.toLowerCase();
    if (platName === 'penguinmod') project.isPM = true;
    else if (platName !== 'turbowarp') project.isPM = confirm('Is this project made in penguinmod? (or uses penguinmods return version)\nClick "ok" if it is and "cancel" if not.');
    if (project.isPM) console.log('Converting from PM to TW');
    else console.log('Converting TW to PM');
    for (const target of project.json.targets) {
      project.setTarget(target);
      await manageBlocks();
    }
    if (project.isPM) platform.name = 'TurboWarp', platform.url = 'https//turbowarp.org/';
    else platform.name = 'PenguinMod', platform.url = 'https://penguinmod.com/', platform.version = 'stable';
  }
  async function loadZIP(data) {
    let projectJSON = null;
    project.zip = await JSZip.loadAsync(data);
    projectJSON = project.zip.files['project.json'];
    if (!projectJSON) throw 'Invalid project, missing project.json';
    if (projectJSON.dir) throw 'Invalid project, project.json is not a file.';
    projectJSON = await project.zip.file('project.json').async('string');
    try {
      projectJSON = JSON.parse(projectJSON);
    } catch {
      throw 'Invalid project, project.json is not valid JSON.';
    }
    project.json = projectJSON;
    await convertProject();
    await project.zip.file('project.json', JSON.stringify(project.json));
    alert('Project converted!\nIf you have any issues please tell me on the github :P.\nhttps://github.com/surv-is-a-dev/ReturnBlockConverter');
    project.zip.generateAsync({ type: 'base64' }).then(function(base64) {
      if (clearOnFinish) {
        project.json = null;
        project.zip = null;
        project.target = null;
        project.isPM = false;
      }
      const dlProject = () => {
        dlBtn.setAttribute('disabled', '1');
        const dl = document.createElement('a');
        dl.href = `data:application/zip;base64,${base64}`;
        dl.target = '_blank';
        dl.click();
        dl.remove();
      };
      if (dlOnFinish) dlProject();
      else {
        dlBtn.onclick = () => dlProject();
        dlBtn.removeAttribute('disabled');
      }
    });
  }
  function tryToLoad() {
    zip = null;
    const input = document.createElement('input');
    input.type = 'file';
    input.accepts = '*.zip,*.pmp,*.sb3';
    document.body.appendChild(input);
      try {
      input.addEventListener('cancel', () => {
        throw 'Canceled operation.';
      });
      input.addEventListener('change', async () => {
        if (input.files.length == 1) {
          await loadZIP(await input.files[0].arrayBuffer());
        } else {
          throw '1 file at a time!';
        }
      });
      input.click();
    } catch(err) {
      project.zip = null;
      project.json = null;
      project.target = null;
      project.isPM = false;
      console.warn('Failed to load ZIP', err);
      alert('Failed to load ZIP, check console for more information.');
    } finally {
      input.remove();
    }
  }
  loadBtn.removeAttribute('disabled');
  window.Editor = { loadZIP: tryToLoad, getProject: () => project };
})();
