const FALLBACK_PDB = `HEADER    LOCAL ACTIVE-SITE SCAFFOLD
ATOM      1  N   HIS A   1      -4.200   1.500   0.000  1.00 20.00           N
ATOM      2  CA  HIS A   1      -3.000   0.700   0.000  1.00 20.00           C
ATOM      3  C   HIS A   1      -1.800   1.400   0.300  1.00 20.00           C
ATOM      4  O   HIS A   1      -1.700   2.600   0.300  1.00 20.00           O
ATOM      5  CB  HIS A   1      -3.000  -0.800   0.300  1.00 20.00           C
ATOM      6  CG  HIS A   1      -4.100  -1.600   0.000  1.00 20.00           C
ATOM      7  ND1 HIS A   1      -5.300  -1.000   0.100  1.00 20.00           N
ATOM      8  CE1 HIS A   1      -6.100  -2.000  -0.100  1.00 20.00           C
ATOM      9  NE2 HIS A   1      -5.500  -3.200  -0.300  1.00 20.00           N
ATOM     10  CD2 HIS A   1      -4.300  -3.000  -0.200  1.00 20.00           C
ATOM     11  N   GLY A  78       0.000   0.200   0.000  1.00 20.00           N
ATOM     12  CA  GLY A  78       1.300   0.700   0.300  1.00 20.00           C
ATOM     13  C   GLY A  78       2.400  -0.200   0.700  1.00 20.00           C
ATOM     14  O   GLY A  78       2.300  -1.400   0.700  1.00 20.00           O
ATOM     15  N   TYR A 164       4.900   0.300   1.100  1.00 20.00           N
ATOM     16  CA  TYR A 164       6.000  -0.500   1.500  1.00 20.00           C
ATOM     17  C   TYR A 164       7.200   0.200   1.000  1.00 20.00           C
ATOM     18  O   TYR A 164       8.200  -0.400   0.900  1.00 20.00           O
ATOM     19  CB  TYR A 164       6.100  -1.900   0.900  1.00 20.00           C
ATOM     20  CG  TYR A 164       5.000  -2.700   1.300  1.00 20.00           C
ATOM     21  CD1 TYR A 164       3.800  -2.200   1.800  1.00 20.00           C
ATOM     22  CD2 TYR A 164       5.100  -4.100   1.100  1.00 20.00           C
ATOM     23  CE1 TYR A 164       2.700  -2.900   2.200  1.00 20.00           C
ATOM     24  CE2 TYR A 164       4.000  -4.800   1.500  1.00 20.00           C
ATOM     25  CZ  TYR A 164       2.800  -4.200   2.000  1.00 20.00           C
ATOM     26  OH  TYR A 164       1.700  -4.800   2.400  1.00 20.00           O
HETATM   27 CU   CU  A 900       0.700  -1.800   0.200  1.00 20.00          CU
HETATM   28  O1  HOH A 901       0.900  -3.200   0.100  1.00 20.00           O
END`;

let manifest = null;
const state = { radius: "core", dir: "REFERENCE_full", stateName: "reactant", showRibbon: true, pdbText: "", viewer: null, loadToken: 0 };
const $ = (selector) => document.querySelector(selector);

function setText(selector, value) { const node = $(selector); if (node) node.textContent = value; }
function radiusLabel(radius) { return radius === "core" ? "Minimal region" : radius.replace("r", "") + " Å"; }
function currentStructure() { return manifest?.structures.find((item) => item.radius === state.radius && item.dir === state.dir) || null; }
function radiusStructures() { return manifest?.structures.filter((item) => item.radius === state.radius) || []; }
function displayName(value) {
  return value.split(" + ").map((part) => ({ pos: "Charged (Pos)", neg: "Charged (Neg)" }[part] || part)).join(" + ");
}
function currentPdbPath() { const current = currentStructure(); return current?.path.replace("/reactant/", `/${state.stateName}/`) || ""; }

function renderPermutations() {
  const list = $("#sidechain-list");
  const block = $(".permutation-block");
  const structures = radiusStructures();
  if (block) block.hidden = state.radius === "core";
  if (state.radius === "core") {
    list.innerHTML = "";
    return;
  }
  list.innerHTML = structures.map((item) => {
    const active = item.dir === state.dir;
    return `<button class="sidechain-row ${active ? "selected" : "inactive"}" data-structure="${item.dir}" aria-pressed="${active}"><span class="sidechain-check" aria-hidden="true"></span><span class="sidechain-name">${displayName(item.label)}</span></button>`;
  }).join("");
  list.querySelectorAll("[data-structure]").forEach((button) => button.addEventListener("click", () => {
    state.dir = button.dataset.structure;
    renderPermutations();
    updateRegionUI();
    loadPdb();
  }));
}

function updateRegionUI() {
  const current = currentStructure();
  if (!current) return;
  setText("#region-name", displayName(current.label));
  document.querySelectorAll("[data-radius]").forEach((button) => { const active = button.dataset.radius === state.radius; button.classList.toggle("active", active); button.setAttribute("aria-selected", active); });
}

function parsePdbAtoms(pdbText) {
  return pdbText.split(/\r?\n/).flatMap((line) => {
    if (!/^(ATOM  |HETATM)/.test(line)) return [];
    const name = line.slice(12, 16).trim();
    const resn = line.slice(17, 20).trim();
    let element = line.slice(76, 78).trim().toUpperCase();
    if (!element) {
      const letters = name.replace(/[^A-Za-z]/g, "").toUpperCase();
      element = letters.startsWith("CU") ? "CU" : letters.slice(0, 1);
    }
    return [{
      serial: Number(line.slice(6, 11)),
      name,
      resn,
      resi: line.slice(22, 26).trim(),
      element,
      x: Number(line.slice(30, 38)),
      y: Number(line.slice(38, 46)),
      z: Number(line.slice(46, 54))
    }];
  }).filter((atom) => Number.isFinite(atom.x) && Number.isFinite(atom.y) && Number.isFinite(atom.z));
}

function point(atom) { return { x: atom.x, y: atom.y, z: atom.z }; }

function isWaterOxygen(atom) {
  return atom.element === "O" && (atom.resn === "WAT" || (atom.serial === 3485 && atom.name === "O2" && atom.resn === "HPO" && atom.resi === "237"));
}

function addExplicitHydrogenSticks(viewer, atoms) {
  const hydrogens = atoms.filter((atom) => atom.element === "H");
  const heavyAtoms = atoms.filter((atom) => atom.element !== "H");
  const waters = atoms.filter(isWaterOxygen);

  // Make every explicit hydrogen easy to see on a poster-sized display.
  const hydrogenBondRadius = .13;
  const hydrogenRadius = .23;
  const waterHydrogenBondRadius = .15;
  const waterHydrogenRadius = .28;
  const hydrogenColor = "#f4f7f6";

  // Use the same simple palette as the main ball-and-stick model for the
  // heavy-atom half of each explicitly drawn H bond.
  const atomColor = (atom) => ({
    C: "#c5cbd0",
    N: "#2d63d4",
    O: "#e33b32",
    S: "#f0c84b",
    P: "#ef9a3f",
    CU: "#c59a62"
  }[atom.element] || "#c5cbd0");

  // Water, including HPO 237 (O2, H1, H2), is drawn explicitly as a complete molecule.
  waters.forEach((oxygen) => viewer.addSphere({ center: point(oxygen), radius: .27, color: "#e33b32", opacity: 1 }));

  hydrogens.forEach((hydrogen) => {
    let nearest = null;
    let nearestDistanceSq = Infinity;
    heavyAtoms.forEach((atom) => {
      const distanceSq = (atom.x - hydrogen.x) ** 2 + (atom.y - hydrogen.y) ** 2 + (atom.z - hydrogen.z) ** 2;
      if (distanceSq < nearestDistanceSq) { nearest = atom; nearestDistanceSq = distanceSq; }
    });
    if (!nearest || nearestDistanceSq > 1.85) {
      viewer.addSphere({ center: point(hydrogen), radius: hydrogenRadius, color: "#f4f7f6", opacity: 1 });
      return;
    }
    const isWaterHydrogen = isWaterOxygen(nearest);
    const bondRadius = isWaterHydrogen ? waterHydrogenBondRadius : hydrogenBondRadius;
    const dx = hydrogen.x - nearest.x;
    const dy = hydrogen.y - nearest.y;
    const dz = hydrogen.z - nearest.z;
    const midpoint = { x: nearest.x + dx / 2, y: nearest.y + dy / 2, z: nearest.z + dz / 2 };
    viewer.addCylinder({ start: point(nearest), end: midpoint, radius: bondRadius, color: atomColor(nearest), opacity: 1 });
    viewer.addCylinder({ start: midpoint, end: point(hydrogen), radius: bondRadius, color: hydrogenColor, opacity: 1 });
    viewer.addSphere({ center: point(hydrogen), radius: isWaterHydrogen ? waterHydrogenRadius : hydrogenRadius, color: hydrogenColor, opacity: 1 });
  });
}

function addCopperOxylCore(viewer, atoms) {
  // These serials are invariant across the supplied subsets:
  // 3482 = Cu 236 and 3483 = O1 HPO 237 (the copper--oxyl oxygen).
  const copper = atoms.find((atom) => atom.serial === 3482 && atom.resn === "CU" && atom.resi === "236")
    || atoms.find((atom) => atom.element === "CU" || atom.resn === "CU");
  const oxylOxygen = atoms.find((atom) => atom.serial === 3483 && atom.name === "O1" && atom.resn === "HPO" && atom.resi === "237")
    || atoms.find((atom) => atom.resn === "HPO" && atom.name === "O1");

  if (copper && oxylOxygen) {
    viewer.addCylinder({ start: point(copper), end: point(oxylOxygen), radius: .068, color: "#aeb7b8", opacity: 1 });
  }
  if (copper) viewer.addSphere({ center: point(copper), radius: .46, color: "#c59a62", opacity: 1 });
  // Keep the oxyl atom at normal ball-and-stick scale: red but never dominant.
  if (oxylOxygen) viewer.addSphere({ center: point(oxylOxygen), radius: .26, color: "#e33b32", opacity: 1 });
}

function renderMolecule() {
  if (!state.viewer || !state.pdbText) return;
  const viewer = state.viewer;
  viewer.removeAllModels();
  viewer.removeAllShapes();
  viewer.removeAllLabels();
  const model = viewer.addModel(state.pdbText, "pdb");
  const atoms = parsePdbAtoms(state.pdbText);
  const proteinResidues = ["ALA", "ARG", "ASN", "ASP", "GLN", "GLU", "GLY", "HIC", "HID", "HIE", "HIP", "ILE", "LEU", "LYS", "PRO", "ROH", "SER", "THR", "TRP", "TYR", "VAL"];
  const mainStick = { colorscheme: "Jmol", radius: .16, opacity: .94 };

  model.setStyle({ resn: proteinResidues }, state.showRibbon ? { stick: mainStick, cartoon: { color: "#879aa2", opacity: .35 } } : { stick: mainStick });
  model.setStyle({ resn: ["4GB", "HPO", "WAT"] }, { stick: { colorscheme: "Jmol", radius: .15, opacity: .97 } });
  model.setStyle({ elem: "O" }, { stick: { color: "#e33b32", radius: .14, opacity: 1 } });
  // Hydrogen and Cu are supplied below as explicit geometry, so they are never lost in auto-bonding.
  model.setStyle({ elem: "H" }, { hidden: true });
  model.setStyle({ elem: "CU" }, { hidden: true });

  addExplicitHydrogenSticks(viewer, atoms);
  addCopperOxylCore(viewer, atoms);

  viewer.setBackgroundColor("#0d141a");
  viewer.zoomTo({});
  viewer.zoom(1.02);
  viewer.render();
}

async function loadPdb() {
  if (!manifest) return;
  const current = currentStructure();
  if (!current) return;
  const token = ++state.loadToken;
  $("#viewer-loading").hidden = false;
  $("#viewer-error").hidden = true;
  setText("#viewer-loading span:last-child", `Loading ${state.stateName}/${current.dir}/subset.pdb…`);
  try {
    const response = await fetch(currentPdbPath());
    if (!response.ok) throw new Error("subset PDB fetch failed");
    const pdbText = await response.text();
    if (token !== state.loadToken) return;
    state.pdbText = pdbText;
  } catch (error) {
    if (token !== state.loadToken) return;
    state.pdbText = FALLBACK_PDB;
    $("#viewer-error").hidden = false;
  }
  $("#viewer-loading").hidden = true;
  renderMolecule();
}

function initViewerWhenReady() {
  const waitFor3Dmol = window.setInterval(() => {
    if (!window.$3Dmol) return;
    window.clearInterval(waitFor3Dmol);
    state.viewer = $3Dmol.createViewer($("#viewer"), { backgroundColor: "#0d141a", antialias: true });
    loadPdb();
  }, 50);
}

async function init() {
  try {
    const response = await fetch("data/structures-manifest.json");
    if (!response.ok) throw new Error("manifest fetch failed");
    manifest = await response.json();
  } catch (error) {
    manifest = { structures: [{ radius: "r2.5", dir: "fallback", label: "local scaffold", permutation: "000", classes: "none", qmAtoms: 28, charge: "+1", path: "data/demo-active-site.pdb" }] };
    state.dir = "fallback";
  }
  renderPermutations();
  updateRegionUI();
  document.querySelectorAll("[data-radius]").forEach((button) => button.addEventListener("click", () => {
    state.radius = button.dataset.radius;
    const first = state.radius === "core" ? radiusStructures()[0] : (radiusStructures().find((item) => item.permutation === "000") || radiusStructures()[0]);
    state.dir = first?.dir || state.dir;
    renderPermutations();
    updateRegionUI();
    loadPdb();
  }));
  document.querySelectorAll("[data-state]").forEach((button) => button.addEventListener("click", () => {
    state.stateName = button.dataset.state;
    document.querySelectorAll("[data-state]").forEach((item) => { const active = item.dataset.state === state.stateName; item.classList.toggle("active", active); item.setAttribute("aria-selected", active); });
    updateRegionUI();
    loadPdb();
  }));
  $("#reset-camera").addEventListener("click", () => { if (state.viewer) { state.viewer.zoomTo({}); state.viewer.zoom(1.05); state.viewer.render(); } });
  $("#focus-site").addEventListener("click", () => { if (state.viewer) { state.viewer.zoomTo({}); state.viewer.zoom(1.35); state.viewer.render(); } });
  initViewerWhenReady();
}

document.addEventListener("DOMContentLoaded", init);
