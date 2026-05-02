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
    alphaCutlinePath: undefined as string | undefined,
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
            status: "not_generated" as const,
            alphaCutlinePath: undefined as string | undefined,
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
          cutline: { ...state.settings.cutline, status: "not_generated" as const, alphaCutlinePath: undefined as string | undefined },
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

    case "SET_CUTLINE_METHOD":
      return {
        ...state,
        isDirty: true,
        settings: {
          ...state.settings,
          cutline: {
            ...state.settings.cutline,
            method: action.method,
            alphaCutlinePath: action.method === "bounding_box" ? (undefined as string | undefined) : state.settings.cutline.alphaCutlinePath,
            status: "not_generated" as const,
          },
        },
      };

    case "SET_CUTLINE_PATH":
      return {
        ...state,
        settings: {
          ...state.settings,
          cutline: {
            ...state.settings.cutline,
            alphaCutlinePath: action.path as string | undefined,
            status: action.status,
          },
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
            alphaCutlinePath: undefined as string | undefined,
            status: "not_generated" as const,
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

    case "SET_CANVAS_SIZE": {
      // Met a jour les dimensions du canvas. Si une image est presente, on
      // refit ses dimensions et la recentre — sinon le visuel deborde / est
      // mal positionne quand le client change de taille depuis l editeur.
      // La cutline alpha doit etre regeneree car son path en pixels image
      // reste valide, mais l offset visuel et la projection en mm changent.
      if (
        state.canvasWidthMm === action.widthMm &&
        state.canvasHeightMm === action.heightMm
      ) {
        return state;
      }
      const next: StickerEditorState = {
        ...state,
        canvasWidthMm: action.widthMm,
        canvasHeightMm: action.heightMm,
        isDirty: true,
      };
      if (state.image) {
        const { widthMm: imgW, heightMm: imgH } = fitImageToCanvas(
          state.image.originalWidthPx,
          state.image.originalHeightPx,
          action.widthMm,
          action.heightMm,
        );
        next.image = {
          ...state.image,
          widthMm: imgW,
          heightMm: imgH,
          xMm: action.widthMm / 2,
          yMm: action.heightMm / 2,
        };
        next.settings = {
          ...state.settings,
          cutline: {
            ...state.settings.cutline,
            alphaCutlinePath: undefined as string | undefined,
            status: "not_generated" as const,
          },
        };
      }
      return next;
    }

    default:
      return state;
  }
}
