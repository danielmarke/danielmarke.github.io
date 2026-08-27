# Does Size Matter? · Choosing the QM Region in QM/MM

This is a static prototype for the QR destination of the poster. It is deliberately dependency-light: the page is plain HTML/CSS/JavaScript and uses 3Dmol.js from its public CDN for the molecular view.

The supplied `spe_frag_core`, `spe_frag_r2.5`, `spe_frag_r5`, and `spe_frag_r7.5` folders are wired in. The site includes the core/minimal PDBs plus all 288 `reactant_spe`, `ts_spe`, and `product_spe` `qm_permutations/*/subset.pdb` files. The 2.5 Å and 5 Å permutation lists follow the row order in the poster image. Each row loads its corresponding local `subset.pdb` file, and the viewer’s reaction-state tabs swap between reactant, transition-state, and product coordinates.

## Run it locally

From the `outputs` folder:

```bash
python3 -m http.server 8765
```

Then open <http://localhost:8765>.

The page loads the copied local subset PDBs. If a local file is unavailable, it falls back to the embedded active-site scaffold so the interaction still renders.

## Add more states or permutation structures

1. Put each exported PDB file in `data/structures/<radius>/<permutation>/subset.pdb`.
2. Add its metadata to `data/structures-manifest.json`: radius, directory name, class label, QM atom count, charge, and relative path.
3. If you want reactant/TS/product switching, copy those state folders beside the current `reactant_spe` files and add a state field to the manifest/UI.

The UI has the key viewer behaviors: rotate, zoom, reset camera, focus active site, switch the minimal region / 2.5 Å / 5 Å / 7.5 Å regions, choose a real permutation PDB, and switch reaction state. The minimal region has no permutation list. The QR code can point directly to the deployed `index.html` URL.

The copper–oxyl fragment is always shown as a bronze Cu sphere and a red O1 sphere. All hydrogen atoms and all `WAT` molecules in the loaded PDB are always shown explicitly in sticks. H1/O2/H2 in HPO residue 237 are treated as a water molecule too; they are not hidden behind a display toggle.

## Deployment

Because this is a static site, upload the contents of this `outputs` folder to GitHub Pages, Netlify, Vercel, or a university web server. After deployment, generate the QR code from the final HTTPS URL; do not encode `localhost`.
