import { Viewer, Point } from "openseadragon";
declare enum ScalebarType {
    NONE = 0,
    MICROSCOPY = 1,
    MAP = 2
}
declare enum ScalebarLocation {
    NONE = 0,
    TOP_LEFT = 1,
    TOP_RIGHT = 2,
    BOTTOM_RIGHT = 3,
    BOTTOM_LEFT = 4
}
interface OSDViewer extends Viewer {
    wrapHorizontal: number;
    wrapVertical: number;
    source: {
        aspectRatio: number;
    };
}
interface ScalebarOptions {
    viewer: OSDViewer;
    type?: ScalebarType;
    pixelsPerMeter?: number;
    referenceItemIdx?: number;
    minWidth?: string;
    location?: ScalebarLocation;
    xOffset?: number;
    yOffset?: number;
    stayInsideImage?: boolean;
    color?: string;
    fontColor?: string;
    backgroundColor?: string;
    fontSize?: string;
    fontFamily?: string;
    barThickness?: number;
    sizeAndTextRenderer?: (ppm: number, minSize: number) => {
        size: number;
        text: string;
    };
}
export declare class Scalebar {
    private viewer;
    private divElt;
    private minWidth;
    private drawScalebar;
    private color;
    private fontColor;
    private backgroundColor;
    private fontSize;
    private fontFamily;
    private barThickness;
    private pixelsPerMeter;
    private referenceItemIdx;
    private location;
    private xOffset;
    private yOffset;
    private stayInsideImage;
    private sizeAndTextRenderer;
    constructor(options: ScalebarOptions);
    updateOptions(options: ScalebarOptions): void;
    setDrawScalebarFunction(type: ScalebarType): (size: number, text: string) => void;
    setMinWidth(minWidth: string): number;
    refresh(options?: ScalebarOptions): void;
    drawMicroscopyScalebar(size: number, text: string): void;
    drawMapScalebar(size: number, text: string): void;
    getScalebarLocation(): Point | undefined;
    getAsCanvas(): HTMLCanvasElement;
    getImageWithScalebarAsCanvas(): HTMLCanvasElement;
}
export {};
