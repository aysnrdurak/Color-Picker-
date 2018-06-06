/**
 * Flat UI color-picker.
 * @author  Simon Reinisch <toports@gmx.de>
 * @license MIT
 */

// Import styles
import '../scss/pickr.scss';

// Import utils
import * as _ from './lib/utils';
import * as Color from './lib/color';

// Import classes
import {HSVaColor} from './lib/hsvacolor';
import Moveable from './helper/moveable';
import Selectable from './helper/selectable';

class Pickr {

    constructor(opt) {

        // Default values
        const def = {
            components: {output: {}},
            onChange: () => undefined,
            onSave: () => undefined
        };

        this.options = Object.assign(def, opt);

        // Bind all private methods
        const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(this));
        for (let fn of methods) {
            if (fn.charAt(0) === '_' && typeof this[fn] === 'function') {
                this[fn] = this[fn].bind(this);
            }
        }

        // Replace element with color picker
        this.root = this._buildRoot();
        this.inputActive = false;

        this.color = new HSVaColor();
        this.lastColor = new HSVaColor();
        this._buildComponents();
    }

    _buildRoot() {

        // Check if element is selector
        if (typeof this.options.el === 'string') {
            this.options.el = document.querySelector(this.options.el);
        }

        const toReplace = this.options.el;
        const html = create(this.options.components);

        // Replace element with actual color-picker
        toReplace.parentElement.replaceChild(html.root, toReplace);

        // Return object
        return html;
    }

    _buildComponents() {

        // Instance reference
        const inst = this;
        const comp = this.options.components;

        const components = {

            palette: new Moveable({
                element: inst.root.palette.picker,
                wrapper: inst.root.palette.palette,

                onchange(x, y) {
                    const color = inst.color;

                    // Calculate saturation based on the position
                    color.s = Math.round((x / this.wrapper.offsetWidth) * 100);

                    // Calculate the value
                    color.v = Math.round(100 - ((y / this.wrapper.offsetHeight) * 100));

                    const cssRGBaString = color.toRGBa();

                    // Set picker and gradient color
                    this.element.style.background = cssRGBaString;
                    this.wrapper.style.background = `
                        linear-gradient(to top, rgba(0, 0, 0, ${color.a}), transparent), 
                        linear-gradient(to left, hsla(${color.h}, 100%, 50%, ${color.a}), rgba(255, 255, 255, ${color.a}))
                    `;

                    // Change current color
                    inst.root.preview.currentColor.style.background = cssRGBaString;
                    inst._updateColor();
                }
            }),

            hueSlider: new Moveable({
                lockX: true,
                element: inst.root.hueSlider.picker,
                wrapper: inst.root.hueSlider.slider,

                onchange(x, y) {
                    if (comp.hue === false) return;

                    // Calculate hue
                    inst.color.h = Math.round((y / this.wrapper.offsetHeight) * 360);

                    // Update color
                    this.element.style.backgroundColor = `hsl(${inst.color.h}, 100%, 50%)`;
                    components.palette.trigger();
                }
            }),

            opacitySlider: new Moveable({
                lockX: true,
                element: inst.root.opacitySlider.picker,
                wrapper: inst.root.opacitySlider.slider,

                onchange(x, y) {
                    if (comp.opacity === false) return;

                    // Calculate opacity
                    inst.color.a = Math.round((y / this.wrapper.offsetHeight) * 1e2) / 1e2;

                    // Update color
                    this.element.style.background = `rgba(0, 0, 0, ${inst.color.a})`;
                    inst.components.palette.trigger();
                }
            }),

            selectable: new Selectable({
                elements: inst.root.input.options,
                className: 'active',
                onchange: () => {
                    inst.inputActive = false;
                    inst.components.palette.trigger();
                }
            })
        };

        this.components = components;

        // Select last color on click
        _.on(this.root.preview.lastColor, 'click', () => this.setHSVa(...this.lastColor.toHSLa(true)));

        // Save and hide / show picker
        _.on(this.root.button, 'click', () => this.root.app.classList.contains('visible') ? this.hide() : this.show());
        _.on(this.root.input.save, 'click', () => this.hide());

        // Cancel selecting if the user taps behind the color picker
        _.on(document, 'click', (e) => _.eventPath(e).includes(this.root.root) ? null : this.cancel());

        // Detect user input
        _.on(this.root.input.result, 'keyup', (e) => {
            const parsed = Color.parseToHSV(e.target.value);

            if (parsed) {
                this.setHSVa(...parsed);
            }

            inst.inputActive = true;
        });

        // Initialize color and trigger hiding
        this.setHSVa(0, 0, 100, 1);
        this.hide();
    }

    _updateColor() {

        // Check if component is present
        if (!this.inputActive && this.root.input.type()) {

            // Update infobox
            this.root.input.result.value = (() => {

                // Construct function name and call if present
                const method = 'to' + this.root.input.type().value;

                if (typeof this.color[method] === 'function') {
                    return this.color[method]();
                }

                return '';
            })();
        }

        // Fire listener
        this.options.onChange(this.color, this);
    }

    /**
     * Hides the color-picker ui.
     */
    hide() {
        this.root.app.classList.remove('visible');

        const cssRGBaString = this.color.toRGBa();

        console.log(cssRGBaString);
        // Change preview and current color
        this.root.preview.lastColor.style.background = cssRGBaString;
        this.root.button.style.background = cssRGBaString;

        // Save last color
        this.lastColor = this.color.clone();

        // Fire listener
        this.options.onSave(this.color, this);
    }

    /**
     * Cancels the current color picking.
     */
    cancel() {
        this.root.app.classList.remove('visible');
    }

    /**
     * Shows the color-picker ui.
     */
    show() {
        this.root.app.classList.add('visible');
    }

    /**
     * Set a specific color.
     * @param h Hue
     * @param s Saturation
     * @param v Value
     * @param a Alpha channel (0 - 1)
     */
    setHSVa(h = 360, s = 0, v = 0, a = 1) {
        if (h < 0 || h > 360 || s < 0 || s > 100 || v < 0 || v > 100 || a < 0 || a > 1) {
            return;
        }

        // Calculate y position of hue slider
        const hueWrapper = this.components.hueSlider.options.wrapper;
        const hueY = hueWrapper.offsetHeight * (h / 360);
        this.components.hueSlider.update(0, hueY);

        // Calculate y position of opacity slider
        const opacityWrapper = this.components.opacitySlider.options.wrapper;
        const opacityY = opacityWrapper.offsetHeight * a;
        this.components.opacitySlider.update(0, opacityY);

        // Calculate y and x position of color palette
        const pickerWrapper = this.components.palette.options.wrapper;
        const pickerX = pickerWrapper.offsetWidth * (s / 100);
        const pickerY = pickerWrapper.offsetHeight * (1 - (v / 100));
        this.components.palette.update(pickerX, pickerY);

        this._updateColor();
        this.color = new HSVaColor(h, s, v, a);
    }

    /**
     * @returns The current Hsvacolor object.
     */
    getColor() {
        return this.color;
    }

    /**
     * @returns The root HTMLElement with all his components.
     */
    getRoot() {
        return this.root;
    }
}

function create(o) {
    const hidden = (con) => con === false ? 'style="display:none" hidden' : '';

    const element = _.createElementFromString(`
         <div class="color-picker">
    
            <div class="button"></div>

            <div class="app">
                <div class="selection">
                    <div class="color-preview" ${hidden(o.preview)}>
                        <div class="last-color"></div>
                        <div class="current-color"></div>
                    </div>
                
                    <div class="color-palette">
                        <div class="picker"></div>
                        <div class="palette"></div>
                    </div>
    
                    <div class="color-chooser" ${hidden(o.hue)}>
                        <div class="picker"></div>
                        <div class="hue slider"></div>
                    </div>
                    
                     <div class="color-opacity" ${hidden(o.opacity)}>
                        <div class="picker"></div>
                        <div class="opacity slider"></div>
                    </div>
                </div>
    
                <div class="output" ${hidden(o.output)}>
                    <input class="result" type="text" spellcheck="false" ${hidden(o.output.input)}>
                    
                    <input class="type" data-type="hex" value="HEX" type="button" ${hidden(o.output.hex)}>
                    <input class="type" data-type="rgba" value="RGBa" type="button" ${hidden(o.output.rgba)}>
                    <input class="type" data-type="hsla" value="HSLa" type="button" ${hidden(o.output.hsla)}>
                    <input class="type" data-type="cmyk" value="CMYK" type="button" ${hidden(o.output.cmyk)}>
                    
                    <input class="save" value="Save" type="button">
                </div>
            </div>
      
        </div>
    `);

    const root = {
        root: element,

        button: element.querySelector('.button'),

        app: element.querySelector('.app '),

        input: {
            options: element.querySelectorAll('.app .output .type'),
            result: element.querySelector('.app .output .result'),
            save: element.querySelector('.app .output .save'),
            type: () => element.querySelector('.app .output .type.active')
        },

        preview: {
            lastColor: element.querySelector('.app .color-preview .last-color'),
            currentColor: element.querySelector('.app .color-preview .current-color')
        },

        palette: {
            picker: element.querySelector('.app .color-palette .picker'),
            palette: element.querySelector('.app .color-palette .palette')
        },

        hueSlider: {
            picker: element.querySelector('.app .color-chooser .picker'),
            slider: element.querySelector('.app .color-chooser .hue.slider')
        },

        opacitySlider: {
            picker: element.querySelector('.app .color-opacity .picker'),
            slider: element.querySelector('.app .color-opacity .opacity.slider')
        }
    };

    // Select option which is not hidden
    Array.from(root.input.options).find(o => !o.hidden && !o.classList.add('active'));
    return root;
}

// Static methods
Pickr.utils = {
    on: _.on,
    off: _.off,
    createElementFromString: _.createElementFromString
};

// Create instance via method
Pickr.create = (options) => new Pickr(options);

// Export
module.exports = Pickr;