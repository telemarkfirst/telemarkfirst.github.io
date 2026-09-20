/* Multi-file Java projects for the lightweight simulator editors. */
(function (global) {
  'use strict';
  const LIBRARY_KEY = 'telemark:java-library:v1';
  const SNAPSHOT_KEY = 'telemark:java-snapshots:v1';
  const CUMULATIVE_PROJECT_KEY = 'telemark:decode-project:v1';
  const TEAM_PACKAGE = 'org.firstinspires.ftc.teamcode';
  const validName = name => typeof name === 'string' && /^[\w$/.-]+\.java$/.test(name) && !name.split('/').includes('..');
  const packageName = source => (source.match(/^\s*package\s+([\w.]+)\s*;/m) || [null, ''])[1];
  const mainFilename = source => ((source.match(/\bpublic\s+(?:final\s+|abstract\s+)?class\s+(\w+)/) || source.match(/\bclass\s+(\w+)/) || [null, 'Main'])[1]) + '.java';
  function inTeamPackage(file) {
    const source = packageName(file.source)
      ? file.source.replace(/^\s*package\s+[\w.]+\s*;/m, 'package ' + TEAM_PACKAGE + ';')
      : 'package ' + TEAM_PACKAGE + ';\n\n' + file.source.replace(/^\s+/, '');
    return {name: file.name.split('/').pop(), source};
  }
  function readLibrary() {
    try { const data = JSON.parse(global.localStorage.getItem(LIBRARY_KEY)); return data && typeof data === 'object' && !Array.isArray(data) ? data : {}; } catch (_) { return {}; }
  }
  function readSnapshots() {
    try { const data = JSON.parse(global.localStorage.getItem(SNAPSHOT_KEY)); return data && typeof data === 'object' && !Array.isArray(data) ? data : {}; } catch (_) { return {}; }
  }
  function validateFiles(files) {
    if (!Array.isArray(files) || !files.length || files.length > 40 || files.some(f => !f || !validName(f.name) || typeof f.source !== 'string') || JSON.stringify(files).length > 2000000) throw new Error('Choose up to 40 Java files, totaling at most 2 MB.');
    if (new Set(files.map(f => f.name)).size !== files.length) throw new Error('The import contains duplicate filenames.');
    return files.map(f => ({name: f.name, source: f.source}));
  }
  function normalizeProjectFiles(input) {
    const checked = validateFiles(input);
    const movedClasses = checked.map(file => {
      const oldPackage = packageName(file.source);
      const className = file.name.split('/').pop().slice(0, -5);
      return oldPackage && oldPackage !== TEAM_PACKAGE ? oldPackage + '.' + className : '';
    }).filter(Boolean);
    return validateFiles(checked.map(inTeamPackage).map(file => ({
      ...file,
      source: movedClasses.reduce((source, qualifiedName) => source.replace(new RegExp('^\\s*import\\s+' + qualifiedName.replace(/\./g, '\\.') + '\\s*;\\s*\\n?', 'm'), ''), file.source),
    })));
  }
  function attach(editor, refresh, options) {
    if (editor.__telemarkProject) return editor.__telemarkProject;
    options = options || {};
    const key = options.key || global.TelemarkEditor.draftKey(editor) + ':project';
    const mainName = mainFilename(editor.value);
    const suppliedFiles = options.initialFiles
      ? normalizeProjectFiles(options.initialFiles)
      : normalizeProjectFiles([{name: mainName, source: editor.value}]);
    let files = suppliedFiles;
    let active = 0;
    let entry = '';
    let appliedStages = [];
    let lesson = null;
    let completed = [];
    let draggedIndex = -1;
    try {
      const saved = JSON.parse(global.localStorage.getItem(key));
      if (saved) {
        files = normalizeProjectFiles(saved.files);
        appliedStages = Array.isArray(saved.appliedStages)
          ? saved.appliedStages.filter(id => typeof id === 'string')
          : [];
        const stageId = typeof options.stage?.id === 'string' ? options.stage.id : '';
        const firstStageVisit = stageId && !appliedStages.includes(stageId);
        if (options.addMissingInitialFiles || firstStageVisit) {
          const existingNames = new Set(files.map(file => file.name));
          const stageNames = Array.isArray(options.stage?.files) ? new Set(options.stage.files) : null;
          const additions = firstStageVisit && stageNames
            ? suppliedFiles.filter(file => stageNames.has(file.name))
            : suppliedFiles;
          files = validateFiles(files.concat(additions.filter(file => !existingNames.has(file.name))));
        }
        if (firstStageVisit) appliedStages.push(stageId);
        entry = saved.entry || '';
        active = Number.isInteger(saved.active) ? Math.max(0, Math.min(saved.active, files.length - 1)) : 0;
      }
    } catch (_) {}
    const currentStageId = typeof options.stage?.id === 'string' ? options.stage.id : '';
    if (currentStageId && !appliedStages.includes(currentStageId)) appliedStages.push(currentStageId);
    if (typeof options.preferredActiveFile === 'string') {
      const preferredActive = files.findIndex(file => file.name === options.preferredActiveFile);
      if (preferredActive >= 0) active = preferredActive;
    }
    if (typeof options.preferredEntry === 'string') entry = options.preferredEntry;
    const bar = document.createElement('div');
    bar.className = 'telemark-project';
    bar.setAttribute('aria-label', 'Java project files');
    editor.parentNode.parentNode.insertBefore(bar, editor.parentNode);
    const status = document.createElement('div');
    status.className = 'telemark-project-status';
    status.setAttribute('role', 'status');
    function report(message) { status.textContent = message; }
    function save() {
      files[active].source = editor.value;
      try {
        global.localStorage.setItem(key, JSON.stringify({files, active, entry, appliedStages}));
        if (lesson && !options.snapshotsOnly) {
          const library = readLibrary();
          library[lesson.id] = {lesson, files, entry, savedAt: Date.now()};
          global.localStorage.setItem(LIBRARY_KEY, JSON.stringify(library));
        }
      } catch (_) { report('Browser storage is full or unavailable. Export your project to keep a copy.'); }
    }
    function refreshEditorView() {
      if (global.TelemarkEditor?.clearDiagnostics) global.TelemarkEditor.clearDiagnostics(document);
      const highlighted = document.getElementById('highlighting-content');
      if (highlighted) {
        highlighted.textContent = editor.value + (editor.value.endsWith('\n') ? ' ' : '');
        if (global.Prism) global.Prism.highlightElement(highlighted);
      }
      const overlay = document.getElementById('highlighting');
      if (overlay) { overlay.scrollTop = editor.scrollTop; overlay.scrollLeft = editor.scrollLeft; }
      if (typeof refresh === 'function') refresh();
      editor.dispatchEvent(new Event('telemark:editor-view-change'));
    }
    function updateActiveChrome() {
      bar.querySelectorAll('.telemark-project-tab').forEach((button, index) => {
        button.setAttribute('aria-pressed', String(index === active));
        button.setAttribute('aria-selected', String(index === active));
        button.parentElement?.toggleAttribute('data-active', index === active);
      });
    }
    function show(rebuild) {
      editor.value = files[active].source;
      editor.selectionStart = editor.selectionEnd = 0;
      editor.scrollTop = editor.scrollLeft = 0;
      if (rebuild) render(); else updateActiveChrome();
      refreshEditorView();
    }
    function entries() {
      return files.flatMap(f => {
        const ast = global.TelemarkJava?.parse(f.source);
        return (ast?.classes || []).filter(c => ['OpMode', 'LinearOpMode'].includes(c.superClass)).map(c => ({name: (packageName(f.source) ? packageName(f.source) + '.' : '') + c.name, label: c.name}));
      });
    }
    function importFiles(incoming) {
      save();
      const added = normalizeProjectFiles(incoming);
      const nextFiles = files.map(file => ({...file}));
      let replaced = 0;
      let firstImportedIndex = -1;
      added.forEach(file => {
        const existingIndex = nextFiles.findIndex(existing => existing.name === file.name);
        if (existingIndex >= 0) {
          nextFiles[existingIndex] = file;
          replaced += 1;
          if (firstImportedIndex < 0) firstImportedIndex = existingIndex;
        } else {
          if (firstImportedIndex < 0) firstImportedIndex = nextFiles.length;
          nextFiles.push(file);
        }
      });
      files = validateFiles(nextFiles);
      active = firstImportedIndex;
      try { if (entry && !entries().some(c => c.name === entry)) entry = ''; } catch (_) {}
      show(true); save();
      report('Imported ' + added.length + ' file(s) into ' + TEAM_PACKAGE + (replaced ? ', replacing ' + replaced + ' existing file(s).' : '.'));
    }
    function chooseFiles(incoming, title) {
      const checked = normalizeProjectFiles(incoming);
      const dialog = document.createElement('dialog');
      dialog.className = 'telemark-project-dialog';
      dialog.setAttribute('aria-label', title);
      const heading = document.createElement('h3'); heading.textContent = title; dialog.appendChild(heading);
      const hint = document.createElement('p'); hint.textContent = 'Choose the files to import. A selected file replaces an existing file with the same name; all other current files are kept.'; dialog.appendChild(hint);
      const choices = checked.map(f => {
        const label = document.createElement('label');
        const input = document.createElement('input'); input.type = 'checkbox';
        const replacesExisting = files.some(existing => existing.name === f.name);
        input.checked = replacesExisting || !/extends\s+(?:OpMode|LinearOpMode)\b/.test(f.source);
        label.appendChild(input); label.appendChild(document.createTextNode(f.name + (replacesExisting ? ' (replace existing)' : ''))); dialog.appendChild(label);
        return {file: f, input};
      });
      const preview = document.createElement('pre'); preview.textContent = checked[0].source; dialog.appendChild(preview);
      choices.forEach(c => c.input.addEventListener('change', () => { preview.textContent = c.file.source; }));
      const error = document.createElement('p'); error.setAttribute('role', 'alert'); dialog.appendChild(error);
      const add = document.createElement('button'); add.textContent = 'Import selected';
      add.addEventListener('click', () => { try { importFiles(choices.filter(c => c.input.checked).map(c => c.file)); dialog.remove(); } catch (e) { error.textContent = e.message; } });
      const cancel = document.createElement('button'); cancel.textContent = 'Cancel'; cancel.addEventListener('click', () => dialog.remove());
      dialog.appendChild(add); dialog.appendChild(cancel); document.body.appendChild(dialog);
      dialog.addEventListener('cancel', () => dialog.remove());
      if (dialog.showModal) dialog.showModal(); else dialog.setAttribute('open', '');
    }
    function closeDialog(dialog) {
      if (typeof dialog.close === 'function' && dialog.open) dialog.close();
      dialog.remove();
    }
    function showDialog(dialog, initialFocus) {
      document.body.appendChild(dialog);
      dialog.addEventListener('cancel', event => { event.preventDefault(); closeDialog(dialog); });
      if (dialog.showModal) dialog.showModal(); else dialog.setAttribute('open', '');
      if (initialFocus) initialFocus.focus();
    }
    function openRenameDialog(index) {
      const dialog = document.createElement('dialog'); dialog.className = 'telemark-project-dialog';
      dialog.setAttribute('aria-label', 'Rename file');
      const heading = document.createElement('h3'); heading.textContent = 'Rename ' + files[index].name; dialog.appendChild(heading);
      const hint = document.createElement('p'); hint.textContent = 'The filename must match its public class. Update the class name and any references in your code too.'; dialog.appendChild(hint);
      const label = document.createElement('label'); label.className = 'telemark-project-dialog-field'; label.textContent = 'Filename';
      const input = document.createElement('input'); input.value = files[index].name; input.autocomplete = 'off'; label.appendChild(input); dialog.appendChild(label);
      const error = document.createElement('p'); error.className = 'telemark-project-dialog-error'; error.setAttribute('role', 'alert'); dialog.appendChild(error);
      const buttons = document.createElement('div'); buttons.className = 'telemark-project-dialog-actions';
      const cancel = document.createElement('button'); cancel.textContent = 'Cancel'; cancel.className = 'telemark-project-dialog-cancel'; cancel.addEventListener('click', () => closeDialog(dialog));
      const apply = document.createElement('button'); apply.textContent = 'Rename'; apply.className = 'telemark-project-dialog-primary';
      apply.addEventListener('click', () => {
        const value = input.value.trim();
        if (!/^[A-Za-z_$][\w$]*\.java$/.test(value) || files.some((f, i) => i !== index && f.name === value)) { error.textContent = 'Enter a unique Java filename, such as Mechanism.java.'; return; }
        save(); files[index].name = value; active = index; closeDialog(dialog); show(true); save(); report('Renamed the file to ' + value + '.');
      });
      input.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); apply.click(); } });
      buttons.appendChild(cancel); buttons.appendChild(apply); dialog.appendChild(buttons); showDialog(dialog, input); input.select();
    }
    function moveFile(fromIndex, toIndex, announce) {
      if (!Number.isInteger(fromIndex) || !Number.isInteger(toIndex) || fromIndex < 0 || fromIndex >= files.length || toIndex < 0 || toIndex >= files.length || fromIndex === toIndex) return false;
      save();
      const activeFile = files[active];
      const moved = files.splice(fromIndex, 1)[0];
      files.splice(toIndex, 0, moved);
      active = files.indexOf(activeFile);
      show(true);
      save();
      if (announce !== false) report('Moved ' + moved.name + ' to tab ' + (toIndex + 1) + '.');
      return true;
    }
    function moveFileAtDrop(fromIndex, targetIndex, after) {
      let insertionIndex = targetIndex + (after ? 1 : 0);
      if (fromIndex < insertionIndex) insertionIndex -= 1;
      return moveFile(fromIndex, insertionIndex);
    }
    function focusActiveTab() {
      const focus = () => bar.querySelector('.telemark-project-tab[aria-pressed="true"]')?.focus();
      if (typeof global.requestAnimationFrame === 'function') global.requestAnimationFrame(focus); else setTimeout(focus, 0);
    }
    function deleteFile(index) {
      if (files.length <= 1 || index < 0 || index >= files.length) return false;
      const filename = files[index].name;
      save(); files.splice(index, 1);
      if (index < active) active -= 1;
      else if (index === active) active = Math.min(index, files.length - 1);
      try { if (entry && !entries().some(c => c.name === entry)) entry = ''; } catch (_) {}
      show(true); save(); report('Deleted ' + filename + '.');
      return true;
    }
    function openDeleteDialog(index) {
      const filename = files[index].name;
      const dialog = document.createElement('dialog'); dialog.className = 'telemark-project-dialog telemark-project-confirm';
      dialog.setAttribute('aria-label', 'Delete ' + filename);
      const icon = document.createElement('span'); icon.className = 'telemark-project-dialog-icon telemark-project-dialog-icon-danger'; icon.setAttribute('aria-hidden', 'true'); icon.textContent = '\u00d7'; dialog.appendChild(icon);
      const heading = document.createElement('h3'); heading.textContent = 'Delete ' + filename + '?'; dialog.appendChild(heading);
      const hint = document.createElement('p'); hint.textContent = 'This removes the file from this browser project. Export first if you may need the code later.'; dialog.appendChild(hint);
      const buttons = document.createElement('div'); buttons.className = 'telemark-project-dialog-actions';
      const cancel = document.createElement('button'); cancel.textContent = 'Cancel'; cancel.className = 'telemark-project-dialog-cancel'; cancel.addEventListener('click', () => closeDialog(dialog));
      const remove = document.createElement('button'); remove.textContent = 'Delete file'; remove.className = 'telemark-project-dialog-danger';
      remove.addEventListener('click', () => {
        closeDialog(dialog); deleteFile(index); focusActiveTab();
      });
      buttons.appendChild(cancel); buttons.appendChild(remove); dialog.appendChild(buttons); showDialog(dialog, cancel);
    }
    function buildCompletedLessonSelect(dialog) {
      const items = Object.values(readLibrary()).filter(item => item?.lesson && completed.includes(item.lesson.id) && item.lesson.id !== lesson?.id).sort((a, b) => a.lesson.title.localeCompare(b.lesson.title, undefined, {numeric: true}));
      if (!items.length) return;
      const label = document.createElement('label'); label.className = 'telemark-project-dialog-field'; label.textContent = 'Completed lesson code';
      const select = document.createElement('select'); select.setAttribute('aria-label', 'Code from a completed lesson');
      const empty = document.createElement('option'); empty.value = ''; empty.textContent = 'Choose a completed lesson\u2026'; select.appendChild(empty);
      items.forEach(item => { const option = document.createElement('option'); option.value = item.lesson.id; option.textContent = item.lesson.title; select.appendChild(option); });
      select.addEventListener('change', () => {
        const item = readLibrary()[select.value];
        if (!item) return;
        closeDialog(dialog);
        try { chooseFiles(item.files, item.lesson.title); } catch (e) { report(e.message); }
      });
      label.appendChild(select); dialog.appendChild(label);
    }
    function openAddDialog(upload) {
      const dialog = document.createElement('dialog'); dialog.className = 'telemark-project-dialog telemark-project-add-dialog';
      dialog.setAttribute('aria-label', 'Add or import a Java file');
      const heading = document.createElement('h3'); heading.textContent = 'Add a Java file'; dialog.appendChild(heading);
      const hint = document.createElement('p'); hint.textContent = 'Every file uses the FTC TeamCode package. Classes in the same package are available by class name; each file still imports the SDK types it uses.'; dialog.appendChild(hint);
      const packageBadge = document.createElement('code'); packageBadge.className = 'telemark-project-package-badge'; packageBadge.textContent = 'package ' + TEAM_PACKAGE + ';'; dialog.appendChild(packageBadge);
      const label = document.createElement('label'); label.className = 'telemark-project-dialog-field'; label.textContent = 'New filename';
      const input = document.createElement('input'); input.placeholder = 'Mechanism.java'; input.autocomplete = 'off'; input.spellcheck = false; label.appendChild(input); dialog.appendChild(label);
      const error = document.createElement('p'); error.className = 'telemark-project-dialog-error'; error.setAttribute('role', 'alert'); dialog.appendChild(error);
      const buttons = document.createElement('div'); buttons.className = 'telemark-project-dialog-actions';
      const cancel = document.createElement('button'); cancel.textContent = 'Cancel'; cancel.className = 'telemark-project-dialog-cancel'; cancel.addEventListener('click', () => closeDialog(dialog));
      const create = document.createElement('button'); create.textContent = 'Create file'; create.className = 'telemark-project-dialog-primary';
      create.addEventListener('click', () => {
        if (files.length >= 40) { error.textContent = 'A project can contain at most 40 Java files.'; return; }
        const raw = input.value.trim();
        const filename = raw.endsWith('.java') ? raw : raw + '.java';
        if (!/^[A-Za-z_$][\w$]*\.java$/.test(filename) || files.some(f => f.name === filename)) { error.textContent = 'Enter a unique Java class filename, such as Mechanism.java.'; return; }
        save(); files.push(inTeamPackage({name: filename, source: 'public class ' + filename.slice(0, -5) + ' {\n\n}\n'})); active = files.length - 1;
        closeDialog(dialog); show(true); save(); report('Created ' + filename + ' in ' + TEAM_PACKAGE + '.');
      });
      input.addEventListener('input', () => { error.textContent = ''; });
      input.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); create.click(); } });
      buttons.appendChild(cancel); buttons.appendChild(create); dialog.appendChild(buttons);
      const divider = document.createElement('div'); divider.className = 'telemark-project-dialog-divider'; divider.textContent = 'or reuse code'; dialog.appendChild(divider);
      const reuse = document.createElement('div'); reuse.className = 'telemark-project-dialog-reuse';
      const importButton = document.createElement('button'); importButton.textContent = 'Import .java or project'; importButton.className = 'telemark-project-dialog-secondary'; importButton.addEventListener('click', () => { closeDialog(dialog); upload.click(); }); reuse.appendChild(importButton);
      const rename = document.createElement('button'); rename.textContent = 'Rename current file'; rename.className = 'telemark-project-dialog-secondary'; rename.addEventListener('click', () => { const current = active; closeDialog(dialog); openRenameDialog(current); }); reuse.appendChild(rename);
      dialog.appendChild(reuse); buildCompletedLessonSelect(dialog); showDialog(dialog, input);
    }
    function snapshotMetadata(metadata) {
      const candidate = metadata || options.stage || lesson || {};
      const id = typeof candidate.id === 'string' && candidate.id.trim()
        ? candidate.id.trim()
        : currentStageId;
      if (!id) throw new Error('This project stage does not have a snapshot ID.');
      return {
        id,
        title: typeof candidate.title === 'string' && candidate.title.trim()
          ? candidate.title.trim()
          : id,
      };
    }
    function listSnapshots() {
      return Object.values(readSnapshots())
        .filter(item => item?.stage && Array.isArray(item.files))
        .sort((left, right) => left.savedAt - right.savedAt)
        .map(item => ({
          ...item,
          files: item.files.map(file => ({...file})),
        }));
    }
    function saveSnapshot(metadata) {
      save();
      const stage = snapshotMetadata(metadata);
      const snapshots = readSnapshots();
      if (snapshots[stage.id]) return {saved: false, snapshot: snapshots[stage.id]};
      const snapshot = {
        stage,
        files: files.map(file => ({...file})),
        entry,
        savedAt: Date.now(),
      };
      try {
        global.localStorage.setItem(SNAPSHOT_KEY, JSON.stringify({...snapshots, [stage.id]: snapshot}));
        report('Saved a read-only snapshot for ' + stage.title + '.');
        return {saved: true, snapshot};
      } catch (_) {
        report('Browser storage is full or unavailable. Export your project to keep a copy.');
        return {saved: false, snapshot: null};
      }
    }
    function downloadProject(snapshot, filename) {
      const payload = {
        format: 'telemark-java-project',
        version: 1,
        files: snapshot.files,
        entry: snapshot.entry || '',
      };
      const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], {type: 'application/json'}));
      const link = document.createElement('a'); link.href = url; link.download = filename; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    function currentSnapshot() {
      save();
      return {
        files: files.map(file => ({...file})),
        entry,
      };
    }
    function openSnapshotsDialog() {
      const snapshots = listSnapshots();
      const dialog = document.createElement('dialog');
      dialog.className = 'telemark-project-dialog telemark-project-snapshots';
      dialog.setAttribute('aria-label', 'Completed project snapshots');
      const heading = document.createElement('h3'); heading.textContent = 'Completed project snapshots'; dialog.appendChild(heading);
      const hint = document.createElement('p'); hint.textContent = snapshots.length
        ? 'These are copies of your own project when each stage first passed. Preview, copy, or export them without changing the current project.'
        : 'A read-only copy of your project will appear here after a mastery stage passes.';
      dialog.appendChild(hint);
      if (!snapshots.length) {
        const close = document.createElement('button'); close.textContent = 'Close'; close.addEventListener('click', () => closeDialog(dialog));
        const actions = document.createElement('div'); actions.className = 'telemark-project-dialog-actions'; actions.appendChild(close); dialog.appendChild(actions);
        showDialog(dialog, close);
        return;
      }
      const stageLabel = document.createElement('label'); stageLabel.className = 'telemark-project-dialog-field'; stageLabel.textContent = 'Completed stage';
      const stageSelect = document.createElement('select'); stageSelect.setAttribute('aria-label', 'Completed project stage');
      snapshots.forEach((snapshot, index) => { const option = document.createElement('option'); option.value = String(index); option.textContent = snapshot.stage.title; stageSelect.appendChild(option); });
      stageLabel.appendChild(stageSelect); dialog.appendChild(stageLabel);
      const fileLabel = document.createElement('label'); fileLabel.className = 'telemark-project-dialog-field'; fileLabel.textContent = 'File';
      const fileSelect = document.createElement('select'); fileSelect.setAttribute('aria-label', 'Snapshot Java file'); fileLabel.appendChild(fileSelect); dialog.appendChild(fileLabel);
      const preview = document.createElement('pre'); preview.className = 'telemark-project-snapshot-preview'; preview.setAttribute('tabindex', '0'); dialog.appendChild(preview);
      const feedback = document.createElement('p'); feedback.className = 'telemark-project-snapshot-status'; feedback.setAttribute('role', 'status'); dialog.appendChild(feedback);
      function selectedSnapshot() { return snapshots[Number(stageSelect.value) || 0]; }
      function selectedFile() { return selectedSnapshot().files[Number(fileSelect.value) || 0]; }
      function showFile() { preview.textContent = selectedFile()?.source || ''; feedback.textContent = ''; }
      function showStage() {
        fileSelect.textContent = '';
        selectedSnapshot().files.forEach((file, index) => { const option = document.createElement('option'); option.value = String(index); option.textContent = file.name; fileSelect.appendChild(option); });
        showFile();
      }
      stageSelect.addEventListener('change', showStage);
      fileSelect.addEventListener('change', showFile);
      const actions = document.createElement('div'); actions.className = 'telemark-project-dialog-actions';
      const close = document.createElement('button'); close.textContent = 'Close'; close.addEventListener('click', () => closeDialog(dialog));
      const copy = document.createElement('button'); copy.textContent = 'Copy file'; copy.addEventListener('click', async () => {
        const source = selectedFile()?.source || '';
        try {
          if (global.navigator.clipboard?.writeText) await global.navigator.clipboard.writeText(source);
          else {
            const temporary = document.createElement('textarea'); temporary.value = source; document.body.appendChild(temporary); temporary.select();
            const copied = Boolean(document.execCommand && document.execCommand('copy'));
            temporary.remove();
            if (!copied) throw new Error('Copy is unavailable');
          }
          feedback.textContent = 'Copied ' + selectedFile().name + '.';
        } catch (_) { feedback.textContent = 'Copy is unavailable in this browser. Select the preview text instead.'; }
      });
      const download = document.createElement('button'); download.textContent = 'Export snapshot'; download.className = 'telemark-project-dialog-primary'; download.addEventListener('click', () => {
        const snapshot = selectedSnapshot();
        const slug = snapshot.stage.id.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'stage';
        downloadProject(snapshot, 'telemark-' + slug + '-snapshot.json');
      });
      actions.appendChild(close); actions.appendChild(copy); actions.appendChild(download); dialog.appendChild(actions);
      showStage(); showDialog(dialog, stageSelect);
    }
    function render() {
      bar.textContent = '';
      const upload = document.createElement('input'); upload.type = 'file'; upload.multiple = true; upload.accept = '.java,.json'; upload.hidden = true;
      upload.addEventListener('change', async () => {
        try {
          const selected = Array.from(upload.files || []);
          if (selected.reduce((sum, f) => sum + f.size, 0) > 2000000) throw new Error('Choose files totaling at most 2 MB.');
          const incoming = [];
          for (const file of selected) {
            const source = await file.text();
            if (file.name.endsWith('.json')) {
              const data = JSON.parse(source);
              if (data.format !== 'telemark-java-project' || data.version !== 1) throw new Error('Choose a Telemark Java project export or .java files.');
              incoming.push(...validateFiles(data.files));
            } else incoming.push({name: file.name, source});
          }
          if (incoming.length) chooseFiles(incoming, 'Import Java files');
        } catch (error) { report(error.message); }
        upload.value = '';
      });
      bar.appendChild(upload);

      const tabs = document.createElement('div'); tabs.className = 'telemark-project-tabs'; tabs.setAttribute('role', 'tablist'); tabs.setAttribute('aria-label', 'Open files'); bar.appendChild(tabs);
      files.forEach((file, index) => {
        const shell = document.createElement('div'); shell.className = 'telemark-project-tab-shell'; shell.toggleAttribute('data-active', index === active); shell.toggleAttribute('data-deletable', files.length > 1); shell.draggable = true; shell.dataset.fileIndex = String(index);
        shell.addEventListener('dragstart', event => {
          if (event.target.closest?.('.telemark-project-tab-rename, .telemark-project-tab-delete')) { event.preventDefault(); return; }
          draggedIndex = index;
          shell.toggleAttribute('data-dragging', true);
          if (event.dataTransfer) { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/x-telemark-file-index', String(index)); }
        });
        shell.addEventListener('dragover', event => {
          if (draggedIndex < 0 && !event.dataTransfer?.types?.includes?.('text/x-telemark-file-index')) return;
          event.preventDefault();
          if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
          const bounds = shell.getBoundingClientRect();
          shell.dataset.dropPosition = event.clientX >= bounds.left + bounds.width / 2 ? 'after' : 'before';
        });
        shell.addEventListener('dragleave', event => {
          if (!event.relatedTarget || !shell.contains(event.relatedTarget)) delete shell.dataset.dropPosition;
        });
        shell.addEventListener('drop', event => {
          event.preventDefault();
          const transferred = Number.parseInt(event.dataTransfer?.getData('text/x-telemark-file-index') || '', 10);
          const fromIndex = Number.isInteger(transferred) ? transferred : draggedIndex;
          const after = shell.dataset.dropPosition === 'after';
          draggedIndex = -1;
          tabs.querySelectorAll('[data-drop-position]').forEach(tab => delete tab.dataset.dropPosition);
          if (fromIndex >= 0 && fromIndex !== index && moveFileAtDrop(fromIndex, index, after)) focusActiveTab();
        });
        shell.addEventListener('dragend', () => {
          draggedIndex = -1;
          bar.querySelectorAll('[data-dragging]').forEach(tab => tab.removeAttribute('data-dragging'));
          bar.querySelectorAll('[data-drop-position]').forEach(tab => delete tab.dataset.dropPosition);
        });
        const button = document.createElement('button'); button.type = 'button'; button.textContent = file.name; button.setAttribute('role', 'tab'); button.setAttribute('aria-pressed', String(index === active)); button.setAttribute('aria-selected', String(index === active)); button.setAttribute('aria-keyshortcuts', 'F2 Alt+ArrowLeft Alt+ArrowRight Shift+Delete'); button.className = 'telemark-project-tab'; button.title = file.name + ' (drag to move, double-click to rename, Shift+Delete to delete)';
        button.addEventListener('click', () => { if (index === active) return; save(); active = index; show(false); save(); });
        button.addEventListener('dblclick', () => openRenameDialog(index));
        button.addEventListener('keydown', event => {
          if (event.shiftKey && event.key === 'Delete' && files.length > 1) {
            event.preventDefault();
            if (!event.repeat && deleteFile(index)) focusActiveTab();
            return;
          }
          if (event.key === 'F2') { event.preventDefault(); openRenameDialog(index); return; }
          if (!event.altKey || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
          const destination = index + (event.key === 'ArrowLeft' ? -1 : 1);
          if (destination < 0 || destination >= files.length) return;
          event.preventDefault();
          if (moveFile(index, destination)) focusActiveTab();
        });
        shell.appendChild(button);
        const rename = document.createElement('button'); rename.type = 'button'; rename.className = 'telemark-project-tab-rename'; rename.textContent = '\u270e'; rename.title = 'Rename ' + file.name; rename.setAttribute('aria-label', 'Rename ' + file.name); rename.draggable = false;
        rename.addEventListener('click', event => { event.stopPropagation(); openRenameDialog(index); }); shell.appendChild(rename);
        if (files.length > 1) {
          const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'telemark-project-tab-delete'; remove.textContent = '\u00d7'; remove.title = 'Delete ' + file.name + ' (Shift-click to skip confirmation)'; remove.setAttribute('aria-label', 'Delete ' + file.name); remove.draggable = false;
          remove.addEventListener('click', event => {
            event.stopPropagation();
            if (event.shiftKey) { if (deleteFile(index)) focusActiveTab(); }
            else openDeleteDialog(index);
          }); shell.appendChild(remove);
        }
        tabs.appendChild(shell);
      });
      const newZone = document.createElement('div'); newZone.className = 'telemark-project-new-zone'; newZone.title = 'Add or import a Java file';
      const add = document.createElement('button'); add.type = 'button'; add.className = 'telemark-project-new'; add.textContent = '+'; add.setAttribute('aria-label', 'Add or import a Java file'); add.addEventListener('click', () => openAddDialog(upload)); newZone.appendChild(add); tabs.appendChild(newZone);

      const utility = document.createElement('div'); utility.className = 'telemark-project-utility'; bar.appendChild(utility);
      try {
        const runnable = entries();
        if (runnable.length > 1) {
          const select = document.createElement('select'); select.setAttribute('aria-label', 'OpMode to run');
          runnable.forEach(c => { const option = document.createElement('option'); option.value = c.name; option.textContent = 'Run: ' + c.label; select.appendChild(option); });
          if (entry) select.value = entry;
          select.addEventListener('change', () => { entry = select.value; save(); if (typeof refresh === 'function') refresh(); }); utility.appendChild(select);
        }
      } catch (_) { /* Incomplete source remains editable. */ }
      if (options.enableSnapshots) {
        const snapshots = document.createElement('button'); snapshots.type = 'button'; snapshots.textContent = 'Snapshots'; snapshots.className = 'telemark-project-tool';
        snapshots.addEventListener('click', openSnapshotsDialog);
        utility.appendChild(snapshots);
      }
      const download = document.createElement('button'); download.type = 'button'; download.textContent = 'Export'; download.className = 'telemark-project-tool';
      download.addEventListener('click', () => {
        downloadProject(currentSnapshot(), 'telemark-project.json');
      });
      utility.appendChild(download);
      const note = document.createElement('p'); note.className = 'telemark-project-note'; note.textContent = 'Saved on this browser \u00b7 Drag tabs to reorder \u00b7 Double-click or use \u270e to rename \u00b7 Shift+Delete removes a file immediately \u00b7 Export to move code to another device.'; bar.appendChild(note);
      bar.appendChild(status);
    }
    editor.addEventListener('input', save);
    // Persist autocomplete edits too, which can be delivered as change events.
    editor.addEventListener('change', save);
    function prerequisiteDiagnostics() {
      const requirements = Array.isArray(options.prerequisites) ? options.prerequisites : [];
      return requirements.flatMap(requirement => {
        const file = files.find(candidate => candidate.name === requirement.file);
        if (!file) return [{code: 'MISSING_PROJECT_FILE', file: requirement.file, message: 'This stage needs ' + requirement.file + ' from an earlier mastery challenge. Add or import that file without replacing your other work.'}];
        let classNode = null;
        try {
          classNode = global.TelemarkJava?.parse(file.source)?.classes?.find(candidate => candidate.name === requirement.className) || null;
        } catch (_) { return []; }
        if (requirement.className && !classNode) return [{code: 'MISSING_PROJECT_CLASS', file: requirement.file, message: requirement.file + ' must declare class ' + requirement.className + '.'}];
        const methods = Array.isArray(requirement.methods) ? requirement.methods : [];
        if (!methods.length || !classNode) return [];
        const existing = new Set(classNode.methods.map(method => method.name));
        return methods.filter(method => !existing.has(method)).map(method => ({
          code: 'MISSING_PROJECT_METHOD',
          file: requirement.file,
          message: requirement.className + ' needs ' + method + '() before this stage can use it.',
        }));
      });
    }
    const project = {
      save,
      importFiles,
      saveSnapshot,
      listSnapshots,
      prerequisiteDiagnostics,
      moveFile(fromIndex, toIndex) { return moveFile(fromIndex, toIndex); },
      key,
      files() { save(); return files.map(f => ({...f})); },
      activeFile() { save(); return files[active] ? {...files[active]} : null; },
      stages() { return appliedStages.slice(); },
      diagnosticLocation(line) {
        let start = 2;
        for (const file of files) {
          const count = file.source.split('\n').length;
          if (line < start + count) return file.name + ':' + Math.max(1, line - start + 1);
          start += count;
        }
        return files[files.length - 1].name;
      },
      source() { files[active].source = editor.value; return global.TelemarkJava.serializeProject(files, entry); },
      reset(source) {
        if (options.preserveProjectOnReset) {
          const currentName = files[active]?.name;
          const supplied = suppliedFiles.find(file => file.name === currentName);
          if (!supplied) { report('This file has no lesson starter. Delete or edit it manually if you no longer need it.'); return; }
          files[active].source = supplied.source;
          show(false); save(); report('Reset ' + currentName + ' without changing your other project files.');
          return;
        }
        files = [inTeamPackage({name: mainFilename(source), source})]; active = 0; entry = ''; appliedStages = []; show(true); save();
      }
    };
    editor.__telemarkProject = project;
    global.addEventListener('message', event => {
      if (event.origin !== global.location.origin || event.source !== global.parent || event.data?.type !== 'telemark:project-lesson') return;
      if (typeof event.data.lesson?.id !== 'string' || typeof event.data.lesson?.title !== 'string' || !Array.isArray(event.data.completed)) return;
      const changed = lesson?.id !== event.data.lesson.id || lesson?.title !== event.data.lesson.title ||
        completed.length !== event.data.completed.length || completed.some((id, index) => id !== event.data.completed[index]);
      lesson = event.data.lesson; completed = event.data.completed;
      save();
      if (changed) render();
    });
    function updateCompletion() {
      try {
        const progress = JSON.parse(global.localStorage.getItem('telemark:progress:v1') || '{}');
        completed = (progress.completedLessons || []).filter(id => !(progress.skippedLessons || []).includes(id) && !(progress.autoCompletedLessons || []).includes(id));
      } catch (_) { completed = []; }
    }
    updateCompletion();
    global.addEventListener('storage', event => {
      if (event.key !== 'telemark:progress:v1') return;
      updateCompletion(); render();
    });
    show(true);
    if (global.parent !== global) global.parent.postMessage({type: 'telemark:project-ready'}, global.location.origin);
    return project;
  }
  function createRunner(editor, options) {
    const runtime = global.TelemarkSimulatorBase.createRuntime(options);
    const program = global.TelemarkSimulatorBase.compileStudentSource(editor.__telemarkProject ? editor.__telemarkProject.source() : editor.value, runtime);
    if (!program.ok) throw new Error(program.diagnostics[0].message);
    if (program.kind !== 'iterative') throw new Error('This lesson expects an OpMode with init() and loop().');
    if (!program.methods.init || !program.methods.loop) throw new Error('Required init() or loop() method is missing.');
    function frame(name) { runtime.clearTelemetry(); program.methods[name]?.(); runtime.updateTelemetry(); }
    return {program, runtime, init() { frame('init'); frame('start'); }, loop() { frame('loop'); }, stop() {
      try { frame('stop'); } finally { runtime.devices.forEach(device => { if (['DcMotor', 'DcMotorEx', 'CRServo'].includes(device._state.type)) device.setPower(0); }); }
    }};
  }
  global.TelemarkProject = {
    attach,
    createRunner,
    CUMULATIVE_PROJECT_KEY,
    SNAPSHOT_KEY,
    readSnapshots: () => Object.values(readSnapshots()).map(snapshot => ({
      ...snapshot,
      files: Array.isArray(snapshot.files) ? snapshot.files.map(file => ({...file})) : [],
    })),
  };
  global.addEventListener('load', () => setTimeout(() => {
    let editor = document.getElementById('code-editor');
    const cm = global.cmEditor;
    if (!editor && cm?.getValue && document.getElementById('editor-wrap')) {
      editor = document.createElement('textarea'); editor.id = 'code-editor'; editor.hidden = true;
      editor.value = cm.getValue(); document.getElementById('editor-wrap').appendChild(editor);
      let switching = false;
      attach(editor, () => { switching = true; cm.setValue(editor.value); switching = false; });
      cm.on('change', () => { if (!switching) { editor.value = cm.getValue(); editor.__telemarkProject.save(); } });
    }
    if (editor && global.TelemarkJava && global.TelemarkEditor && !editor.__telemarkProject) {
      attach(editor);
    }
  }, 30));
})(window);
