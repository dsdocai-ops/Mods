// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
package com.omega.client.schematic;

import net.minecraft.block.Block;
import net.minecraft.block.BlockState;
import net.minecraft.block.Blocks;
import net.minecraft.registry.Registries;
import net.minecraft.state.StateManager;
import net.minecraft.state.property.Property;
import net.minecraft.util.Identifier;

import java.util.Map;
import java.util.Optional;

/**
 * Converts a BlockState to/from a string like "minecraft:oak_stairs[facing=north,half=bottom]" -
 * the same shape vanilla commands like /setblock accept, though this doesn't delegate to vanilla's
 * own command parser (BlockArgumentParser's exact signature has shifted across versions and this
 * project can't test-verify either choice); instead it goes through the lower-level Property API
 * directly (name()/parse()), which is the same thing that parser itself is built on.
 *
 * Both directions are exercised by code this project fully controls (save + load of our own
 * .omschem.json files), which is why this is lower-risk than e.g. the Litematica importer even
 * though the exact Property method names below are still a moderate- rather than high-confidence
 * spot - see mod/README.md.
 */
public final class BlockStateCodec {
    private BlockStateCodec() {
    }

    public static String serialize(BlockState state) {
        StringBuilder sb = new StringBuilder(Registries.BLOCK.getId(state.getBlock()).toString());
        Map<Property<?>, Comparable<?>> entries = state.getEntries();
        if (!entries.isEmpty()) {
            sb.append('[');
            boolean first = true;
            for (Map.Entry<Property<?>, Comparable<?>> entry : entries.entrySet()) {
                if (!first) sb.append(',');
                first = false;
                sb.append(entry.getKey().getName()).append('=').append(nameOf(entry.getKey(), entry.getValue()));
            }
            sb.append(']');
        }
        return sb.toString();
    }

    /** Returns the block's default state if the id/properties can't be resolved, rather than null - always yields something renderable. */
    public static BlockState deserialize(String serialized) {
        int bracket = serialized.indexOf('[');
        String blockIdPart = bracket >= 0 ? serialized.substring(0, bracket) : serialized;

        Identifier id = Identifier.tryParse(blockIdPart);
        Block block = id != null ? Registries.BLOCK.get(id) : Blocks.AIR;
        BlockState state = block.getDefaultState();
        if (bracket < 0) return state;

        String propsPart = serialized.substring(bracket + 1, serialized.length() - (serialized.endsWith("]") ? 1 : 0));
        if (propsPart.isEmpty()) return state;

        StateManager<Block, BlockState> stateManager = block.getStateManager();
        for (String pair : propsPart.split(",")) {
            int eq = pair.indexOf('=');
            if (eq < 0) continue;
            Property<?> property = stateManager.getProperty(pair.substring(0, eq));
            if (property == null) continue;
            state = withParsedValue(state, property, pair.substring(eq + 1));
        }
        return state;
    }

    @SuppressWarnings({"unchecked", "rawtypes"})
    private static String nameOf(Property property, Comparable value) {
        return property.name(value);
    }

    @SuppressWarnings({"unchecked", "rawtypes"})
    private static BlockState withParsedValue(BlockState state, Property property, String valueText) {
        Optional parsed = property.parse(valueText);
        if (parsed.isPresent()) {
            return state.with(property, (Comparable) parsed.get());
        }
        return state;
    }
}
