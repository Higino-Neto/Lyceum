// Chapter outline: answers an explicit command and reports the tree back as an
// event (request/response over the same versioned message channel).
import { CMD_GET_OUTLINE, EVT_OUTLINE_LOADED, isOutlineNode } from "../../lyceum-core.mjs";

export function installOutlineFeature({ bus, facade }) {
  bus.onCommand(CMD_GET_OUTLINE, async data => {
    const requestId = typeof data?.requestId === "string" ? data.requestId : undefined;
    const outline = await facade.getOutline();
    const tree = Array.isArray(outline) && outline.every(isOutlineNode) ? outline : [];
    bus.emit(EVT_OUTLINE_LOADED, { outline: tree, requestId });
  });
}