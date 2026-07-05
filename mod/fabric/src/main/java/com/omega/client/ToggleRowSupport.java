// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
package com.omega.client;

import net.minecraft.client.gui.widget.ButtonWidget;
import net.minecraft.text.Text;

import java.util.function.BooleanSupplier;
import java.util.function.Consumer;

/**
 * The on/off-button-over-a-ModConfig-field row every ClickGui-family screen here builds
 * (ClickGuiScreen, HudScreen) - pulled out once both screens ended up with byte-for-byte copies of
 * it. Can't live in mod/common (ButtonWidget/Text are Yarn-mapped types), but is shared within this
 * loader the same way ParticleScreenSupport/VisualScreenSupport share the mapping-agnostic half of
 * their own screens.
 */
final class ToggleRowSupport {
    private ToggleRowSupport() {
    }

    static void addToggleRow(Consumer<ButtonWidget> addChild, int x, int y, int width, String label,
                              BooleanSupplier getter, Consumer<Boolean> setter, Runnable onChange) {
        ButtonWidget button = ButtonWidget.builder(rowText(label, getter.getAsBoolean()), b -> {
            boolean next = !getter.getAsBoolean();
            setter.accept(next);
            b.setMessage(rowText(label, next));
            onChange.run();
        }).dimensions(x, y, width, 20).build();
        addChild.accept(button);
    }

    static Text rowText(String label, boolean enabled) {
        return Text.literal(label + ": " + (enabled ? "ON" : "OFF"));
    }
}
