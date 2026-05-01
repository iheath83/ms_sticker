import type { ConfiguratorState, ConfiguratorAction } from "./configurator.types";

export function configuratorReducer(
  state: ConfiguratorState,
  action: ConfiguratorAction,
): ConfiguratorState {
  switch (action.type) {
    case "SELECT_SHAPE":
      return { ...state, selectedShapeId: action.id };
    case "SELECT_SIZE":
      return { ...state, selectedSizeId: action.id, sizeMode: "preset" };
    case "SET_SIZE_MODE":
      return { ...state, sizeMode: action.mode };
    case "SET_CUSTOM_WIDTH":
      return { ...state, customWidth: action.value, sizeMode: "custom" };
    case "SET_CUSTOM_HEIGHT":
      return { ...state, customHeight: action.value, sizeMode: "custom" };
    case "SELECT_QUANTITY":
      return { ...state, quantity: action.qty, useCustomQty: false };
    case "SET_CUSTOM_QTY_MODE":
      return { ...state, useCustomQty: action.on };
    case "SET_CUSTOM_QTY_VALUE":
      return { ...state, customQuantity: action.value, useCustomQty: true };
    case "SELECT_MATERIAL":
      return { ...state, selectedMaterialId: action.id };
    case "SELECT_LAMINATION":
      return { ...state, selectedLaminationId: action.id };
    case "SET_NOTE":
      return { ...state, customerNote: action.note };
    case "SET_UPLOAD_STATE":
      return {
        ...state,
        uploadState: action.state,
        uploadError: action.error ?? null,
      };
    case "SET_UPLOADED_FILE":
      return {
        ...state,
        uploadedFile: action.file,
        uploadState: action.file ? "uploaded" : "idle",
        uploadError: null,
      };
    case "SET_PRICE":
      return { ...state, priceResult: action.result, priceLoading: action.loading };
    case "SET_ADD_STATE":
      return { ...state, addState: action.state };
    default:
      return state;
  }
}

export function createInitialState(params: {
  shapes: { id: string }[];
  sizes: { id: string }[];
  materials: { id: string }[];
  laminations: { id: string; isDefault?: boolean }[];
  minWidthMm: number;
  minHeightMm: number;
}): ConfiguratorState {
  return {
    selectedShapeId: params.shapes[0]?.id ?? "",
    sizeMode: "preset",
    selectedSizeId: params.sizes[0]?.id ?? "",
    customWidth: params.minWidthMm,
    customHeight: params.minHeightMm,
    quantity: 50,
    useCustomQty: false,
    customQuantity: "",
    selectedMaterialId: params.materials[0]?.id ?? "",
    selectedLaminationId:
      params.laminations.find((l) => l.isDefault)?.id ??
      params.laminations[0]?.id ??
      null,
    customerNote: "",
    uploadedFile: null,
    uploadState: "idle",
    uploadError: null,
    priceResult: null,
    priceLoading: false,
    addState: "idle",
  };
}
