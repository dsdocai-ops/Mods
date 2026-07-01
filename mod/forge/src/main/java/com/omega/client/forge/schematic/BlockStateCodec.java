package com.omega.client.forge.schematic;

import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.world.level.block.Block;
import net.minecraft.world.level.block.Blocks;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.level.block.state.StateDefinition;
import net.minecraft.world.level.block.state.properties.Property;

import java.util.Map;
import java.util.Optional;

/**
 * Forge-side twin of the Fabric BlockStateCodec. This file carries the most stacked renames of
 * anything in the Forge module: Registries -> BuiltInRegistries, Identifier -> ResourceLocation
 * (both well-established, higher confidence), StateManager -> StateDefinition,
 * getDefaultState()/getStateManager() -> defaultBlockState()/getStateDefinition(),
 * state.getEntries() -> state.getValues(), state.with(...) -> state.setValue(...) (moderate
 * confidence), and property.name()/parse() carried over unchanged from the Fabric version since
 * no better official-mappings guess is available (same moderate confidence as there, see
 * mod/README.md).
 */
public final class BlockStateCodec {
    private BlockStateCodec() {
    }

    public static String serialize(BlockState state) {
        StringBuilder sb = new StringBuilder(BuiltInRegistries.BLOCK.getKey(state.getBlock()).toString());
        Map<Property<?>, Comparable<?>> entries = state.getValues();
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

        ResourceLocation id = ResourceLocation.tryParse(blockIdPart);
        Block block = id != null ? BuiltInRegistries.BLOCK.get(id) : Blocks.AIR;
        BlockState state = block.defaultBlockState();
        if (bracket < 0) return state;

        String propsPart = serialized.substring(bracket + 1, serialized.length() - (serialized.endsWith("]") ? 1 : 0));
        if (propsPart.isEmpty()) return state;

        StateDefinition<Block, BlockState> stateDefinition = block.getStateDefinition();
        for (String pair : propsPart.split(",")) {
            int eq = pair.indexOf('=');
            if (eq < 0) continue;
            Property<?> property = stateDefinition.getProperty(pair.substring(0, eq));
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
            return state.setValue(property, (Comparable) parsed.get());
        }
        return state;
    }
}
