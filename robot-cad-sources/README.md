# Robot CAD source files

These are the original, high-detail files supplied for the coding-challenge robots. They are retained here for provenance and future remeshing; the simulator loads the browser-optimized GLBs in `static/simulator/models/`.

| Challenge | Source file(s) | Browser asset |
| --- | --- | --- |
| Unit 2 — Team 30450 DECODE robot | `30450-decode-robot.step`, `30450-decode-robot.glb` | `30450-decode-robot-telemark.glb` |
| Unit 3 — Quixilver 8404 | `Quilxilver-full-robot-8404.step`, `Quilxilver-full-robot-8404.glb` | `quixilver-8404-itd-telemark.glb` |
| Unit 4 — 2025 FTC Robot by Manning | `2025-ftc-robot-manning.step` (original upload: `v4-v3.step`) | `2025-ftc-robot-manning-telemark.glb` |
| Unit 5 — 2024 FTC Robot — CENTERSTAGE by Manning | `2024-centerstage-bot-manning-meador-.step` | `2024-centerstage-manning-telemark.glb` |
| Unit 6 — FTC 17438 Input/Output | `ftc17438_inputoutput_robot_model_29.03.2024.glb` | `ftc17438-inputoutput-telemark.glb` |
| Unit 8 — FTC 11115 Gluten Free SKYSTONE | `11115_Gluten_Free_Skystone_Robot_STEP.step`, `11115_Gluten_Free_Skystone_Robot_GLB.glb` | `11115-gluten-free-skystone-telemark.glb` |
| Unit 13 — DECODE field | `decode-field.glb` (preferred) or `decode-field.obj` | `decode-field-optimized.glb` after upload |

The browser assets are modified from their sources through tessellation, spatial simplification, mesh optimization, and/or quantization. Attribution is displayed in each simulator and retained in available GLB metadata.

For Units 3, 5, and 6, existing triangles in the optimized CAD are partitioned into named chassis and mechanism nodes by `scripts/split-cad-mechanisms.cjs`. This lets student motor commands articulate the real robot geometry; the simulator does not add substitute wheels, rollers, claws, or arms to these imported models.

The Team 11115 asset is used with the team's explicit permission and is modified from the original. `scripts/prepare-11115-cad.cjs` preserves the chassis, wheels, intake rollers, DR4B bars, and scoring assembly as separate optimized groups. Unit 8 uses simplified lift motion controlled by one motor; it does not reproduce the exact mechanism in the team's [SKYSTONE reveal video](https://www.youtube.com/watch?v=i2g_b54MEFI).

The Team 30450 Sharp Face Robotics asset is used with the team's explicit permission and is modified from the original. Its browser model preserves the chassis, wheels, three-stage intake, transfer, flywheel, and trigger as independently animated groups. Attribution links to the team's [official FIRST page](https://ftc-events.firstinspires.org/2025/team/30450).

Unit 13 reuses the optimized Team 30450 DECODE chassis and four independently movable CAD wheel nodes. The DECODE presentation adds stable `telemark-cad-intake`, `telemark-cad-transfer`, and `telemark-cad-flywheel` nodes, each animated from its own measured motor output. Run `npm run prepare:decode-field` after uploading either field source. A GLB is validated and prepared directly; an OBJ is triangulated, given smooth normals, and converted to a browser GLB. Until an upload exists, the checked-in manifest deliberately selects the procedural field fallback.
