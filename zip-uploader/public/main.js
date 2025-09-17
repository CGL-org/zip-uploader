async function loadFiles() {
  try {
    const res = await fetch('/files');
    const data = await res.json();

    const div = document.getElementById('file-list');
    if (!data.files || data.files.length === 0) {
      div.textContent = "No files found";
      return;
    }

    div.innerHTML = data.files.map(f =>
      f.publicUrl
        ? `<div><a href="${f.publicUrl}" target="_blank">${f.name}</a></div>`
        : `<div>${f.name}</div>`
    ).join('');
  } catch (err) {
    document.getElementById('file-list').textContent = "Error loading files";
    console.error(err);
  }
}

loadFiles();
