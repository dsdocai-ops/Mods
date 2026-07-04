package com.omega.client.forge.network;

import com.omega.client.ModConfig;
import com.omega.client.presence.OmegaPresence;
import io.netty.buffer.Unpooled;
import net.minecraft.client.Minecraft;
import net.minecraft.network.FriendlyByteBuf;
import net.minecraft.network.protocol.game.ServerboundCustomPayloadPacket;
import net.minecraft.resources.ResourceLocation;
import net.minecraftforge.client.event.ClientPlayerNetworkEvent;
import net.minecraftforge.common.MinecraftForge;
import net.minecraftforge.network.NetworkEvent;
import net.minecraftforge.network.NetworkRegistry;
import net.minecraftforge.network.event.EventNetworkChannel;

import java.util.UUID;

/**
 * Forge-side twin of the Fabric PresenceNetworking - same protocol (announce own UUID on the
 * omega-client:presence channel at join, collect announced UUIDs for the nametag badge, dormant on
 * plain vanilla servers; see the Fabric class + OmegaPresence for the full rationale).
 *
 * API note: written against Forge 47.2's actual networking API (NetworkRegistry.newEventChannel +
 * NetworkEvent) after CI rejected a first draft that guessed the ChannelBuilder shape - that
 * refactor is from a later Forge line, not 1.20.1-47.2.0. The accept-everything version predicates
 * keep the channel optional, so a server without a counterpart is fine.
 */
public final class PresenceNetworking {
    public static final ResourceLocation CHANNEL = new ResourceLocation("omega-client", "presence");

    private PresenceNetworking() {
    }

    public static void register(ModConfig config) {
        EventNetworkChannel channel = NetworkRegistry.newEventChannel(CHANNEL, () -> "1", s -> true, s -> true);
        channel.addListener((NetworkEvent.ServerCustomPayloadEvent event) -> {
            FriendlyByteBuf payload = event.getPayload();
            if (payload != null && payload.readableBytes() >= 16) {
                UUID uuid = payload.readUUID();
                Minecraft.getInstance().execute(() -> OmegaPresence.add(uuid));
            }
            event.getSource().get().setPacketHandled(true);
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
