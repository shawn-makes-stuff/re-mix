import * as THREE from 'three';

function averageNormalOutwardDot(geometry) {
  const g = geometry;
  const pos = g.getAttribute('position');
  if (!pos || pos.itemSize !== 3) return 0;

  if (!g.getAttribute('normal')) g.computeVertexNormals();
  const nor = g.getAttribute('normal');

  const centroid = new THREE.Vector3();
  const vertex = new THREE.Vector3();
  const count = pos.count;
  for (let i = 0; i < count; i += 1) {
    vertex.fromBufferAttribute(pos, i);
    centroid.add(vertex);
  }
  centroid.multiplyScalar(1 / Math.max(count, 1));

  let sum = 0;
  for (let i = 0; i < count; i += 1) {
    vertex.fromBufferAttribute(pos, i).sub(centroid).normalize();
    const nx = nor.getX(i);
    const ny = nor.getY(i);
    const nz = nor.getZ(i);
    sum += vertex.x * nx + vertex.y * ny + vertex.z * nz;
  }
  return sum / Math.max(count, 1);
}

function flipWindingInPlace(geometry) {
  const g = geometry;
  if (g.index) {
    const idx = g.index;
    for (let i = 0; i < idx.count; i += 3) {
      const a = idx.getX(i);
      const b = idx.getX(i + 1);
      const c = idx.getX(i + 2);
      idx.setX(i, a);
      idx.setX(i + 1, c);
      idx.setX(i + 2, b);
    }
    idx.needsUpdate = true;
  } else {
    const pos = g.getAttribute('position');
    const nor = g.getAttribute('normal');

    for (let i = 0; i < pos.count; i += 3) {
      let x1 = pos.getX(i + 1);
      let y1 = pos.getY(i + 1);
      let z1 = pos.getZ(i + 1);
      let x2 = pos.getX(i + 2);
      let y2 = pos.getY(i + 2);
      let z2 = pos.getZ(i + 2);
      pos.setXYZ(i + 1, x2, y2, z2);
      pos.setXYZ(i + 2, x1, y1, z1);

      if (nor) {
        x1 = nor.getX(i + 1);
        y1 = nor.getY(i + 1);
        z1 = nor.getZ(i + 1);
        x2 = nor.getX(i + 2);
        y2 = nor.getY(i + 2);
        z2 = nor.getZ(i + 2);
        nor.setXYZ(i + 1, x2, y2, z2);
        nor.setXYZ(i + 2, x1, y1, z1);
      }
    }

    pos.needsUpdate = true;
    if (nor) nor.needsUpdate = true;
  }

  g.computeVertexNormals();
  return g;
}

export function fixNormalsForGeometry(geometry) {
  if (!geometry || !geometry.getAttribute) return geometry;

  if (!geometry.getAttribute('normal')) geometry.computeVertexNormals();

  const outwardDot = averageNormalOutwardDot(geometry);
  if (outwardDot < 0) {
    flipWindingInPlace(geometry);
  } else {
    geometry.computeVertexNormals();
  }
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}
