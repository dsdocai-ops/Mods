package com.omega.client.forge.network;

import com.omega.client.forge.ModConfig;
import com.omega.client.presence.OmegaPresence;
import io.netty.buffer.Unpooled;
import net.minecraft.client.Minecraft;
import net.minecraft.network.FriendlyByteBuf;
import net.minecraft.network.protocol.game.ServerboundCustomPayloadPacket;
import net.minecraft.resources.ResourceLocation;
import net.minecraftforge.client.event.ClientPlayerNetworkEvent;
import net.minecraftforge.common.MinecraftForge;
import net.minecraftforge.network.ChannelBuilder;
import net.minecraftforge.network.EventNetworkChannel;

import java.util.UUID;

/**
 * Forge-side twin of the Fabric PresenceNetworking - same protocol (announce own UUID on the
 * omega-client:presence channel at join, collect announced UUIDs for the nametag badge, dormant on
 * plain vanilla servers; see the Fabric class + OmegaPresence for the full rationale).
 *
 * API-confidence note: Forge 1.20.1 (47.2.x) refactored its networking to ChannelBuilder /
 * EventNetworkChannel, and this file is written against that shape - `.optional()` so a missing
 * server counterpart is fine, raw ServerboundCustomPayloadPacket for the send (the event channel's
 * own send helpers are the murkier part of that refactor). This is a fresh, never-compiled guess
 * of the same kind mod/README.md tracks - CI will judge it.
 */
public final class PresenceNetworking {
    public static final ResourceLocation CHANNEL = new ResourceLocation("omega-client", "presence");

    private PresenceNetworking() {
    }

    public static void register(ModConfig config) {
        EventNetworkChannel channel = ChannelBuilder.named(CHANNEL).optional().eventNetworkChannel();
        channel.addListener(event -> {
            FriendlyByteBuf payload = event.getPayload();
            if (payload != null && payload.readableBytes() >= 16) {
                UUID uuid = payload.readUUID();
                Minecraft.getInstance().execute(() -> OmegaPresence.add(uuid));
            }
            event.getSource().setPacketHandled(true);
        });

        MinecraftForge.EVENT_BUS.addListener((ClientPlayerNetworkEvent.LoggingIn event) -> {
            if (!config.showOmegaUsersEnabled || event.getPlayer() == null) return;
            OmegaPresence.add(event.getPlayer().getUUID());
            FriendlyByteBuf buf = new FriendlyByteBuf(Unpooled.buffer());
            buf.writeUUID(event.getPlayer().getUUID());
            event.getConnection().send(new ServerboundCustomPayloadPacket(CHANNEL, buf));
        });

        MinecraftForge.EVENT_BUS.addListener((ClientPlayerNetworkEvent.LoggingOut event) -> OmegaPresence.clear());
    }
}
