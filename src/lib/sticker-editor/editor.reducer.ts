import type {
  StickerEditorState,
  EditorAction,
  EditorSettings,
  EditorValidation,
} from "./editor.types";
import { fitImageToCanvas } from "./geometry.utils";

const EMPTY_VALIDATION: EditorValidation = {
  isValid: false,
  errors: [],
  warnings: [],
};

export const DEFAULT_SETTINGS: EditorSettings = {
  cutline: {
    enabled: true,
    cutType: "kiss_cut",
    method: "bounding_box",
    offsetMm: 2,
    status: "not_generated",
  },
  bleedMm: 2,
  safetyMarginMm: 2,
  showBleed: true,
  showSafety: true,
  showCutline: true,
  showGrid: false,
};

export function createInitialState(
  canvasWidthMm: number,
  canvasHeightMm: number,
): StickerEditorState {
  return {
    canvasWidthMm,
    canvasHeightMm,
    image: null,
    settings: DEFAULT_SETTINGS,
    isUploading: false,
    uploadError: null,
    validation: EMPTY_VALIDATION,
    isDirty: false,
  };
}

export function editorReducer(
  state: StickerEditorState,
  action: EditorAction,
): StickerEditorState {
  switch (action.type) {
    case "SET_IMAGE": {
      return {
        ...state,
        image: action.image,
        uploadError: null,
        isUploading: false,
        isDirty: true,
        settings: {
          ...state.settings,
          cutline: {
            ...state.settings.cutline,
            status: "not_generated",
          },
        },
      };
    }

    case "CLEAR_IMAGE":
      return {
        ...state,
        image: null,
        isDirty: false,
        settings: {
          ...state.settings,
          cutline: { ...state.settings.cutline, status: "not_generated" },
        },
      };

    case "UPDATE_IMAGE":
      if (!state.image) return state;
      return {
        ...state,
        image: { ...state.image, ...action.patch },
        isDirty: true,
      };

    case "SET_UPLOADING":
      return { ...state, isUploading: action.value, uploadError: null };

    case "SET_UPLOAD_ERROR":
      return { ...state, isUploading: false, uploadError: action.error };

    case "SET_CUT_TYPE":
      return {
        ...state,
        isDirty: true,
        settings: {
          ...state.settings,
          cutline: { ...state.settings.cutline, cutType: action.cutType },
        },
      };

    case "SET_CUTLINE_OFFSET":
      return {
        ...state,
        isDirty: true,
        settings: {
          ...state.settings,
          cutline: {
            ...state.settings.cutline,
            offsetMm: action.offsetMm,
            status: "not_generated",
          },
        },
      };

    case "SET_BLEED":
      return {
        ...state,
        isDirty: true,
        settings: { ...state.settings, bleedMm: action.bleedMm },
      };

    case "SET_SAFETY_MARGIN":
      return {
        ...state,
        isDirty: true,
        settings: { ...state.settings, safetyMarginMm: action.safetyMarginMm },
      };

    case "TOGGLE_SHOW_BLEED":
      return {
        ...state,
        settings: { ...state.settings, showBleed: !state.settings.showBleed },
      };

    case "TOGGLE_SHOW_SAFETY":
      return {
        ...state,
        settings: { ...state.settings, showSafety: !state.settings.showSafety },
      };

    case "TOGGLE_SHOW_CUTLINE":
      return {
        ...state,
        settings: {
          ...state.settings,
          showCutline: !state.settings.showCutline,
        },
      };

    case "TOGGLE_SHOW_GRID":
      return {
        ...state,
        settings: { ...state.settings, showGrid: !state.settings.showGrid },
      };

    case "SET_VALIDATION":
      return { ...state, validation: action.validation };

    case "RESET_POSITION": {
      if (!state.image) return state;
      const { widthMm, heightMm } = fitImageToCanvas(
        state.image.originalWidthPx,
        state.image.originalHeightPx,
        state.canvasWidthMm,
        state.canvasHeightMm,
      );
      return {
        ...state,
        isDirty: true,
        image: {
          ...state.image,
          widthMm,
          heightMm,
          xMm: state.canvasWidthMm / 2,
          yMm: state.canvasHeightMm / 2,
          rotationDeg: 0,
        },
      };
    }

    default:
      return state;
  }
}
