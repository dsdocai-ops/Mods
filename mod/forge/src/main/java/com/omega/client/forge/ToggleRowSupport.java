// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
package com.omega.client.forge;

import net.minecraft.client.gui.components.Button;
import net.minecraft.network.chat.Component;

import java.util.function.BooleanSupplier;
import java.util.function.Consumer;

/**
 * Forge-side twin of the Fabric ToggleRowSupport - see that class for what/why. Same renames as
 * every other Forge screen here vs. Yarn: Text -> Component, ButtonWidget -> Button.
 */
final class ToggleRowSupport {
    private ToggleRowSupport() {
    }

    static void addToggleRow(Consumer<Button> addChild, int x, int y, int width, String label,
                              BooleanSupplier getter, Consumer<Boolean> setter, Runnable onChange) {
        Button button = Button.builder(rowText(label, getter.getAsBoolean()), b -> {
            boolean next = !getter.getAsBoolean();
            setter.accept(next);
            b.setMessage(rowText(label, next));
            onChange.run();
        }).bounds(x, y, width, 20).build();
        addChild.accept(button);
    }

    static Component rowText(String label, boolean enabled) {
        return Component.literal(label + ": " + (enabled ? "ON" : "OFF"));
    }
}
