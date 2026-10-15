const AREA_PADDING = 3;
const GROUP_DISTANCE = 3;
const FLAT_CHANNEL_CHANGE = 8;
const FLAT_CHANNEL_RANGE = 6;
const MAX_TOTAL_INK_CHANGE = 0.17;
const MAX_CHANNEL_SHARE_CHANGE = 0.05;
const MAX_CENTER_MOVE_X = 0.45;
const MAX_CENTER_MOVE_Y = 0.16;
const MAX_ROW_PROFILE_CHANGE = 0.35;
const WHOLE_PIXEL_SHIFT_GAIN = 2;

const LINEAR_CHANNEL = Array.from({ length: 256 }, (_, value) => {
  const channel = value / 255;
  return channel <= 0.04045
    ? channel / 12.92
    : ((channel + 0.055) / 1.055) ** 2.4;
});

function padBox(box, image) {
  const x = Math.max(0, Math.floor(box.x) - AREA_PADDING);
  const y = Math.max(0, Math.floor(box.y) - AREA_PADDING);
  const right = Math.min(
    image.width,
    Math.ceil(box.x + box.width) + AREA_PADDING,
  );
  const bottom = Math.min(
    image.height,
    Math.ceil(box.y + box.height) + AREA_PADDING,
  );
  return { x, y, width: right - x, height: bottom - y };
}

function unionBox(left, right) {
  const x = Math.min(left.x, right.x);
  const y = Math.min(left.y, right.y);
  const boxRight = Math.max(left.x + left.width, right.x + right.width);
  const boxBottom = Math.max(left.y + left.height, right.y + right.height);
  return { x, y, width: boxRight - x, height: boxBottom - y };
}

function boxesAreClose(left, right) {
  const horizontalGap = Math.max(
    0,
    left.x - (right.x + right.width),
    right.x - (left.x + left.width),
  );
  const verticalGap = Math.max(
    0,
    left.y - (right.y + right.height),
    right.y - (left.y + left.height),
  );
  return horizontalGap <= GROUP_DISTANCE && verticalGap <= GROUP_DISTANCE;
}

function groupBoxes(boxes) {
  const groups = [];
  const visited = new Set();

  for (let start = 0; start < boxes.length; start += 1) {
    if (visited.has(start)) continue;

    const members = [];
    const pending = [start];
    visited.add(start);
    while (pending.length > 0) {
      const index = pending.pop();
      members.push(boxes[index]);
      for (let candidate = 0; candidate < boxes.length; candidate += 1) {
        if (
          !visited.has(candidate) &&
          boxesAreClose(boxes[index], boxes[candidate])
        ) {
          visited.add(candidate);
          pending.push(candidate);
        }
      }
    }

    if (members.length > 1) {
      groups.push(members.reduce(unionBox));
    }
  }

  return groups;
}

function pixelOffset(image, x, y) {
  return (y * image.width + x) * 4;
}

function hasTransparency(image, area) {
  for (let y = area.y; y < area.y + area.height; y += 1) {
    for (let x = area.x; x < area.x + area.width; x += 1) {
      if (image.data[pixelOffset(image, x, y) + 3] !== 255) return true;
    }
  }
  return false;
}

function channelRange(image, x, y, channel) {
  let minimum = 255;
  let maximum = 0;
  for (
    let nearY = Math.max(0, y - 1);
    nearY <= Math.min(image.height - 1, y + 1);
    nearY += 1
  ) {
    for (
      let nearX = Math.max(0, x - 1);
      nearX <= Math.min(image.width - 1, x + 1);
      nearX += 1
    ) {
      const value = image.data[pixelOffset(image, nearX, nearY) + channel];
      minimum = Math.min(minimum, value);
      maximum = Math.max(maximum, value);
    }
  }
  return maximum - minimum;
}

function changesFlatPixel(baseline, candidate, area) {
  for (let y = area.y; y < area.y + area.height; y += 1) {
    for (let x = area.x; x < area.x + area.width; x += 1) {
      const offset = pixelOffset(baseline, x, y);
      const channels = [0, 1, 2];
      const changed = channels.some(
        (channel) =>
          Math.abs(
            baseline.data[offset + channel] - candidate.data[offset + channel],
          ) > FLAT_CHANNEL_CHANGE,
      );
      if (
        changed &&
        channels.every(
          (channel) =>
            channelRange(baseline, x, y, channel) <= FLAT_CHANNEL_RANGE &&
            channelRange(candidate, x, y, channel) <= FLAT_CHANNEL_RANGE,
        )
      ) {
        return true;
      }
    }
  }
  return false;
}

function median(values) {
  values.sort((left, right) => left - right);
  return values[Math.floor(values.length / 2)];
}

function borderColor(image, area) {
  const channels = [[], [], []];
  const right = area.x + area.width - 1;
  const bottom = area.y + area.height - 1;

  function addPixel(x, y) {
    const offset = pixelOffset(image, x, y);
    for (let channel = 0; channel < 3; channel += 1) {
      channels[channel].push(image.data[offset + channel]);
    }
  }

  for (let x = area.x; x <= right; x += 1) {
    addPixel(x, area.y);
    if (bottom !== area.y) addPixel(x, bottom);
  }
  for (let y = area.y + 1; y < bottom; y += 1) {
    addPixel(area.x, y);
    if (right !== area.x) addPixel(right, y);
  }

  return channels.map(median).map((value) => LINEAR_CHANNEL[value]);
}

function inkStatistics(image, area, background) {
  const channelInk = [0, 0, 0];
  const rowInk = Array(area.height).fill(0);
  let weightedX = 0;
  let weightedY = 0;
  let totalInk = 0;

  for (let y = area.y; y < area.y + area.height; y += 1) {
    for (let x = area.x; x < area.x + area.width; x += 1) {
      const offset = pixelOffset(image, x, y);
      let pixelInk = 0;
      for (let channel = 0; channel < 3; channel += 1) {
        const ink = Math.abs(
          LINEAR_CHANNEL[image.data[offset + channel]] - background[channel],
        );
        channelInk[channel] += ink;
        pixelInk += ink;
      }
      totalInk += pixelInk;
      rowInk[y - area.y] += pixelInk;
      weightedX += x * pixelInk;
      weightedY += y * pixelInk;
    }
  }

  return {
    center: {
      x: totalInk === 0 ? area.x + area.width / 2 : weightedX / totalInk,
      y: totalInk === 0 ? area.y + area.height / 2 : weightedY / totalInk,
    },
    channelShares: channelInk.map((ink) =>
      totalInk === 0 ? 0 : ink / totalInk,
    ),
    rowShares: rowInk.map((ink) => (totalInk === 0 ? 0 : ink / totalInk)),
    totalInk,
  };
}

function changesInk(baseline, candidate, area) {
  const background = borderColor(baseline, area);
  const before = inkStatistics(baseline, area, background);
  const after = inkStatistics(candidate, area, background);

  if (before.totalInk === 0) return after.totalInk !== 0;
  if (
    Math.abs(after.totalInk - before.totalInk) / before.totalInk >
    MAX_TOTAL_INK_CHANGE
  ) {
    return true;
  }
  if (
    before.channelShares.some(
      (share, channel) =>
        Math.abs(after.channelShares[channel] - share) >
        MAX_CHANNEL_SHARE_CHANGE,
    )
  ) {
    return true;
  }
  if (Math.abs(after.center.x - before.center.x) > MAX_CENTER_MOVE_X) {
    return true;
  }
  if (Math.abs(after.center.y - before.center.y) > MAX_CENTER_MOVE_Y) {
    return true;
  }

  const fullestRow = Math.max(...before.rowShares, ...after.rowShares);
  return before.rowShares.some(
    (share, row) =>
      Math.abs(after.rowShares[row] - share) >
      MAX_ROW_PROFILE_CHANGE * fullestRow,
  );
}

function rgbDifference(baseline, candidate, area, shiftX = 0, shiftY = 0) {
  let difference = 0;
  for (let y = area.y; y < area.y + area.height; y += 1) {
    const baselineY = y - shiftY;
    if (baselineY < 0 || baselineY >= baseline.height) return null;
    for (let x = area.x; x < area.x + area.width; x += 1) {
      const baselineX = x - shiftX;
      if (baselineX < 0 || baselineX >= baseline.width) return null;
      const baselineOffset = pixelOffset(baseline, baselineX, baselineY);
      const candidateOffset = pixelOffset(candidate, x, y);
      for (let channel = 0; channel < 3; channel += 1) {
        difference += Math.abs(
          baseline.data[baselineOffset + channel] -
            candidate.data[candidateOffset + channel],
        );
      }
    }
  }
  return difference;
}

function isWholePixelMove(baseline, candidate, area) {
  const unshifted = rgbDifference(baseline, candidate, area);
  if (unshifted === 0) return false;

  for (let shiftY = -2; shiftY <= 2; shiftY += 1) {
    for (let shiftX = -2; shiftX <= 2; shiftX += 1) {
      if (shiftX === 0 && shiftY === 0) continue;
      const shifted = rgbDifference(baseline, candidate, area, shiftX, shiftY);
      if (shifted !== null && shifted * WHOLE_PIXEL_SHIFT_GAIN < unshifted) {
        return true;
      }
    }
  }
  return false;
}

function areaLooksLikeGlyphDrift(baseline, candidate, area) {
  return (
    !hasTransparency(baseline, area) &&
    !hasTransparency(candidate, area) &&
    !changesFlatPixel(baseline, candidate, area) &&
    !changesInk(baseline, candidate, area)
  );
}

export function isGlyphPositionDrift(baseline, candidate, boxes) {
  if (
    baseline.width !== candidate.width ||
    baseline.height !== candidate.height ||
    boxes.length === 0
  ) {
    return false;
  }

  const validBoxes = boxes.filter((box) => box.width > 0 && box.height > 0);
  if (validBoxes.length !== boxes.length) return false;

  const regions = validBoxes.map((box) => padBox(box, baseline));
  if (
    regions.some((area) => !areaLooksLikeGlyphDrift(baseline, candidate, area))
  ) {
    return false;
  }

  const groups = groupBoxes(validBoxes).map((box) => padBox(box, baseline));
  return groups.every(
    (area) =>
      areaLooksLikeGlyphDrift(baseline, candidate, area) &&
      !isWholePixelMove(baseline, candidate, area),
  );
}
