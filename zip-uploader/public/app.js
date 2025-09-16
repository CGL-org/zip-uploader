console.log("✅ Script loaded");

async function loadFiles() {
  try {
    const res = await fetch("/files");
    console.log("Response:", res);
    const result = await res.json();
    console.log("Result JSON:", result);

    const files = result.files || [];
    const list = document.getElementById("file-list");
    list.innerHTML = "";

    if (files.length === 0) {
      list.innerHTML = "<li>No files found</li>";
      return;
    }

    files.forEach(file => {
      const li = document.createElement("li");
      const link = document.createElement("a");
      link.href = file.publicUrl;
      link.textContent = file.name;
      link.target = "_blank";
      li.appendChild(link);
      list.appendChild(li);
    });
  } catch (err) {
    console.error("❌ Error loading files:", err);
    document.getElementById("file-list").innerHTML =
      "<li>Error loading files</li>";
  }
}

loadFiles();
