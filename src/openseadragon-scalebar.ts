import OpenSeadragon, { Viewer, Point } from "openseadragon";

enum ScalebarType {
  NONE = 0,
  MICROSCOPY = 1,
  MAP = 2,
}

enum ScalebarLocation {
  NONE = 0,
  TOP_LEFT = 1,
  TOP_RIGHT = 2,
  BOTTOM_RIGHT = 3,
  BOTTOM_LEFT = 4,
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
  sizeAndTextRenderer?: (
    ppm: number,
    minSize: number
  ) => { size: number; text: string };
}

class ScalebarSizeAndTextRenderer {
  /**
   * Metric length. From nano meters to kilometers.
   */
  public static METRIC_LENGTH(ppm: number, minSize: number) {
    return getScalebarSizeAndTextForMetric(ppm, minSize, "m");
  }
  /**
   * Imperial length. Choosing the best unit from thou, inch, foot and mile.
   */
  public static IMPERIAL_LENGTH(ppm: number, minSize: number) {
    var maxSize = minSize * 2;
    var ppi = ppm * 0.0254;
    if (maxSize < ppi * 12) {
      if (maxSize < ppi) {
        var ppt = ppi / 1000;
        return getScalebarSizeAndText(ppt, minSize, "th");
      }
      return getScalebarSizeAndText(ppi, minSize, "in");
    }
    var ppf = ppi * 12;
    if (maxSize < ppf * 2000) {
      return getScalebarSizeAndText(ppf, minSize, "ft");
    }
    var ppmi = ppf * 5280;
    return getScalebarSizeAndText(ppmi, minSize, "mi");
  }
  /**
   * Astronomy units. Choosing the best unit from arcsec, arcminute, and degree
   */
  public static ASTRONOMY(ppa: number, minSize: number) {
    var maxSize = minSize * 2;
    if (maxSize < ppa * 60) {
      return getScalebarSizeAndText(ppa, minSize, '"', false, "");
    }
    var ppminutes = ppa * 60;
    if (maxSize < ppminutes * 60) {
      return getScalebarSizeAndText(ppminutes, minSize, "'", false, "");
    }
    var ppd = ppminutes * 60;
    return getScalebarSizeAndText(ppd, minSize, "&#176", false, "");
  }
  /**
   * Standard time. Choosing the best unit from second (and metric divisions),
   * minute, hour, day and year.
   */
  public static STANDARD_TIME(pps: number, minSize: number) {
    var maxSize = minSize * 2;
    if (maxSize < pps * 60) {
      return getScalebarSizeAndTextForMetric(pps, minSize, "s");
    }
    var ppminutes = pps * 60;
    if (maxSize < ppminutes * 60) {
      return getScalebarSizeAndText(ppminutes, minSize, "minute", true);
    }
    var pph = ppminutes * 60;
    if (maxSize < pph * 24) {
      return getScalebarSizeAndText(pph, minSize, "hour", true);
    }
    var ppd = pph * 24;
    if (maxSize < ppd * 365.25) {
      return getScalebarSizeAndText(ppd, minSize, "day", true);
    }
    var ppy = ppd * 365.25;
    return getScalebarSizeAndText(ppy, minSize, "year", true);
  }
  /**
   * Generic metric unit. One can use this function to create a new metric
   * scale. For example, here is an implementation of energy levels:
   * function(ppeV, minSize) {
   *   return OpenSeadragon.ScalebarSizeAndTextRenderer.METRIC_GENERIC(
   *           ppeV, minSize, "eV");
   * }
   */
  public static METRIC_GENERIC() {
    return getScalebarSizeAndTextForMetric;
  }
}

export class Scalebar {
  private viewer: OSDViewer;
  private divElt: HTMLDivElement;
  private minWidth: number;
  private drawScalebar: (size: number, text: string) => void;
  private color: string;
  private fontColor: string;
  private backgroundColor: string;
  private fontSize: string;
  private fontFamily: string;
  private barThickness: number;
  private pixelsPerMeter: number | null;
  private referenceItemIdx: number;
  private location: ScalebarLocation;
  private xOffset: number;
  private yOffset: number;
  private stayInsideImage: boolean;
  private sizeAndTextRenderer;

  constructor(options: ScalebarOptions) {
    options = options || {};
    if (!options.viewer) {
      throw new Error("A viewer must be specified.");
    }
    this.viewer = options.viewer;

    this.divElt = document.createElement("div");
    this.viewer.container.appendChild(this.divElt);
    this.divElt.style.position = "relative";
    this.divElt.style.margin = "0";
    this.divElt.style.pointerEvents = "none";

    this.minWidth = this.setMinWidth(options.minWidth || "150px");

    this.drawScalebar = this.setDrawScalebarFunction(
      options.type || ScalebarType.MICROSCOPY
    );
    this.color = options.color || "black";
    this.fontColor = options.fontColor || "black";
    this.backgroundColor = options.backgroundColor || "none";
    this.fontSize = options.fontSize || "";
    this.fontFamily = options.fontFamily || "";
    this.barThickness = options.barThickness || 2;
    this.pixelsPerMeter = options.pixelsPerMeter || null;
    this.referenceItemIdx = options.referenceItemIdx || 0;
    this.location = options.location || ScalebarLocation.BOTTOM_LEFT;
    this.xOffset = options.xOffset || 5;
    this.yOffset = options.yOffset || 5;
    this.stayInsideImage =
      options.stayInsideImage !== undefined ? options.stayInsideImage : true;
    this.sizeAndTextRenderer =
      options.sizeAndTextRenderer || ScalebarSizeAndTextRenderer.METRIC_LENGTH;

    var self = this;
    this.viewer.addHandler("open", function () {
      self.refresh();
    });
    this.viewer.addHandler("animation", function () {
      self.refresh();
    });
    this.viewer.addHandler("resize", function () {
      self.refresh();
    });
  }

  updateOptions(options: ScalebarOptions) {
    if (!options) {
      return;
    }
    if (options.type) {
      this.setDrawScalebarFunction(options.type);
    }
    if (options.minWidth) {
      this.setMinWidth(options.minWidth);
    }
    if (options.color) {
      this.color = options.color;
    }
    if (options.fontColor) {
      this.fontColor = options.fontColor;
    }
    if (options.backgroundColor) {
      this.backgroundColor = options.backgroundColor;
    }
    if (options.fontSize) {
      this.fontSize = options.fontSize;
    }
    if (options.fontFamily) {
      this.fontFamily = options.fontFamily;
    }
    if (options.barThickness) {
      this.barThickness = options.barThickness;
    }
    if (options.pixelsPerMeter) {
      this.pixelsPerMeter = options.pixelsPerMeter;
    }
    if (options.referenceItemIdx) {
      this.referenceItemIdx = options.referenceItemIdx;
    }
    if (options.location) {
      this.location = options.location;
    }
    if (options.xOffset) {
      this.xOffset = options.xOffset;
    }
    if (options.yOffset) {
      this.yOffset = options.yOffset;
    }
    if (options.stayInsideImage) {
      this.stayInsideImage = options.stayInsideImage;
    }
    if (options.sizeAndTextRenderer) {
      this.sizeAndTextRenderer = options.sizeAndTextRenderer;
    }
  }

  setDrawScalebarFunction(type: ScalebarType) {
    switch (type) {
      case ScalebarType.MAP:
        return this.drawMapScalebar;
      case ScalebarType.MICROSCOPY:
        return this.drawMicroscopyScalebar;
      default:
        return function () {
          return undefined;
        };
    }
  }

  setMinWidth(minWidth: string) {
    this.divElt.style.width = minWidth;
    // Make sure to display the element before getting is width
    this.divElt.style.display = "";
    return this.divElt.offsetWidth;
  }

  refresh(options?: ScalebarOptions) {
    if (options) this.updateOptions(options);

    if (
      !this.viewer.isOpen() ||
      !this.drawScalebar ||
      !this.pixelsPerMeter ||
      !this.location
    ) {
      this.divElt.style.display = "none";
      return;
    }
    this.divElt.style.display = "";

    var viewport = this.viewer.viewport;
    var tiledImage = this.viewer.world.getItemAt(this.referenceItemIdx);
    var zoom = tiledImageViewportToImageZoom(
      tiledImage,
      viewport.getZoom(true)
    );
    var currentPPM = zoom * this.pixelsPerMeter;
    var props = this.sizeAndTextRenderer(currentPPM, this.minWidth);

    this.drawScalebar(props.size, props.text);
    var location = this.getScalebarLocation();
    if (location) {
      this.divElt.style.left = location.x + "px";
      this.divElt.style.top = location.y + "px";
    }
  }

  drawMicroscopyScalebar(size: number, text: string) {
    this.divElt.style.fontSize = this.fontSize;
    this.divElt.style.fontFamily = this.fontFamily;
    this.divElt.style.textAlign = "center";
    this.divElt.style.color = this.fontColor;
    this.divElt.style.border = "none";
    this.divElt.style.borderBottom =
      this.barThickness + "px solid " + this.color;
    this.divElt.style.backgroundColor = this.backgroundColor;
    this.divElt.innerHTML = text;
    this.divElt.style.width = size + "px";
  }

  drawMapScalebar(size: number, text: string) {
    this.divElt.style.fontSize = this.fontSize;
    this.divElt.style.fontFamily = this.fontFamily;
    this.divElt.style.textAlign = "center";
    this.divElt.style.color = this.fontColor;
    this.divElt.style.border = this.barThickness + "px solid " + this.color;
    this.divElt.style.borderTop = "none";
    this.divElt.style.backgroundColor = this.backgroundColor;
    this.divElt.innerHTML = text;
    this.divElt.style.width = size + "px";
  }

  getScalebarLocation(): Point | undefined {
    if (this.location === ScalebarLocation.TOP_LEFT) {
      var x = 0;
      var y = 0;
      if (this.stayInsideImage) {
        var pixel = this.viewer.viewport.pixelFromPoint(new Point(0, 0), true);
        if (!this.viewer.wrapHorizontal) {
          x = Math.max(pixel.x, 0);
        }
        if (!this.viewer.wrapVertical) {
          y = Math.max(pixel.y, 0);
        }
      }
      return new Point(x + this.xOffset, y + this.yOffset);
    }

    if (this.location === ScalebarLocation.TOP_RIGHT) {
      var barWidth = this.divElt.offsetWidth;
      var container = this.viewer.container;
      var x = container.offsetWidth - barWidth;
      var y = 0;
      if (this.stayInsideImage) {
        var pixel = this.viewer.viewport.pixelFromPoint(new Point(1, 0), true);
        if (!this.viewer.wrapHorizontal) {
          x = Math.min(x, pixel.x - barWidth);
        }
        if (!this.viewer.wrapVertical) {
          y = Math.max(y, pixel.y);
        }
      }
      return new Point(x - this.xOffset, y + this.yOffset);
    }

    if (this.location === ScalebarLocation.BOTTOM_RIGHT) {
      var barWidth = this.divElt.offsetWidth;
      var barHeight = this.divElt.offsetHeight;
      var container = this.viewer.container;
      var x = container.offsetWidth - barWidth;
      var y = container.offsetHeight - barHeight;
      if (this.stayInsideImage) {
        var pixel = this.viewer.viewport.pixelFromPoint(
          new Point(1, 1 / this.viewer.source.aspectRatio),
          true
        );
        if (!this.viewer.wrapHorizontal) {
          x = Math.min(x, pixel.x - barWidth);
        }
        if (!this.viewer.wrapVertical) {
          y = Math.min(y, pixel.y - barHeight);
        }
      }
      return new Point(x - this.xOffset, y - this.yOffset);
    }

    if (this.location === ScalebarLocation.BOTTOM_LEFT) {
      var barHeight = this.divElt.offsetHeight;
      var container = this.viewer.container;
      var x = 0;
      var y = container.offsetHeight - barHeight;
      if (this.stayInsideImage) {
        var pixel = this.viewer.viewport.pixelFromPoint(
          new Point(0, 1 / this.viewer.source.aspectRatio),
          true
        );
        if (!this.viewer.wrapHorizontal) {
          x = Math.max(x, pixel.x);
        }
        if (!this.viewer.wrapVertical) {
          y = Math.min(y, pixel.y - barHeight);
        }
      }
      return new Point(x + this.xOffset, y - this.yOffset);
    }
  }

  getAsCanvas(): HTMLCanvasElement {
    const canvas = document.createElement("canvas");
    canvas.width = this.divElt.offsetWidth;
    canvas.height = this.divElt.offsetHeight;
    const context = canvas.getContext("2d");
    if (context) {
      context.fillStyle = this.backgroundColor;
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = this.color;
      context.fillRect(
        0,
        canvas.height - this.barThickness,
        canvas.width,
        canvas.height
      );

      if (this.drawScalebar === this.drawMapScalebar) {
        context.fillRect(0, 0, this.barThickness, canvas.height);
        context.fillRect(
          canvas.width - this.barThickness,
          0,
          this.barThickness,
          canvas.height
        );
      }
      context.font = window.getComputedStyle(this.divElt).font;
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillStyle = this.fontColor;
      const hCenter = canvas.width / 2;
      const vCenter = canvas.height / 2;
      if (this.divElt.textContent)
        context.fillText(this.divElt.textContent, hCenter, vCenter);
    }
    return canvas;
  }

  getImageWithScalebarAsCanvas(): HTMLCanvasElement {
    const imgCanvas = this.viewer.drawer.canvas as HTMLCanvasElement;
    const newCanvas = document.createElement("canvas");
    newCanvas.width = imgCanvas.width;
    newCanvas.height = imgCanvas.height;
    const newCtx = newCanvas.getContext("2d");
    if (newCtx) newCtx.drawImage(imgCanvas, 0, 0);
    const scalebarCanvas = this.getAsCanvas();
    const location = this.getScalebarLocation();
    if (newCtx && location)
      newCtx.drawImage(scalebarCanvas, location.x, location.y);
    return newCanvas;
  }
}

function tiledImageViewportToImageZoom(
  tiledImage: any,
  viewportZoom: number
): number {
  var ratio =
    (tiledImage._scaleSpring.current.value *
      tiledImage.viewport._containerInnerSize.x) /
    tiledImage.source.dimensions.x;
  return ratio * viewportZoom;
}

function getScalebarSizeAndText(
  ppm: number,
  minSize: number,
  unitSuffix: string,
  handlePlural?: boolean,
  spacer?: string
): { size: number; text: string } {
  spacer = spacer === undefined ? " " : spacer;
  var value = normalize(ppm, minSize);
  var factor = roundSignificand((value / ppm) * minSize, 3);
  var size = value * minSize;
  var plural = handlePlural && factor > 1 ? "s" : "";
  return {
    size: size,
    text: factor + spacer + unitSuffix + plural,
  };
}

function getScalebarSizeAndTextForMetric(
  ppm: number,
  minSize: number,
  unitSuffix: string
): { size: number; text: string } {
  var value = normalize(ppm, minSize);
  var factor = roundSignificand((value / ppm) * minSize, 3);
  var size = value * minSize;
  var valueWithUnit = getWithUnit(factor, unitSuffix);
  return {
    size: size,
    text: valueWithUnit,
  };
}

function normalize(value: number, minSize: number): number {
  var significand = getSignificand(value);
  var minSizeSign = getSignificand(minSize);
  var result = getSignificand(significand / minSizeSign);
  if (result >= 5) {
    result /= 5;
  }
  if (result >= 4) {
    result /= 4;
  }
  if (result >= 2) {
    result /= 2;
  }
  return result;
}

function getSignificand(x: number): number {
  return x * Math.pow(10, Math.ceil(-log10(x)));
}

function roundSignificand(x: number, decimalPlaces: number): number {
  var exponent = -Math.ceil(-log10(x));
  var power = decimalPlaces - exponent;
  var significand = x * Math.pow(10, power);
  // To avoid rounding problems, always work with integers
  if (power < 0) {
    return Math.round(significand) * Math.pow(10, -power);
  }
  return Math.round(significand) / Math.pow(10, power);
}

function log10(x: number): number {
  return Math.log(x) / Math.log(10);
}

function getWithUnit(value: number, unitSuffix: string): string {
  if (value < 0.000001) {
    return value * 1000000000 + " n" + unitSuffix;
  }
  if (value < 0.001) {
    return value * 1000000 + " μ" + unitSuffix;
  }
  if (value < 1) {
    return value * 1000 + " m" + unitSuffix;
  }
  if (value >= 1000) {
    return value / 1000 + " k" + unitSuffix;
  }
  return value + " " + unitSuffix;
}
