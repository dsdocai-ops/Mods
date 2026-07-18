// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
package com.omega.client.network;

import com.omega.client.ModConfig;
import com.omega.client.presence.OmegaPresence;
import io.netty.buffer.Unpooled;
import net.fabricmc.fabric.api.client.networking.v1.ClientPlayConnectionEvents;
import net.fabricmc.fabric.api.client.networking.v1.ClientPlayNetworking;
import net.minecraft.network.PacketByteBuf;
import net.minecraft.util.Identifier;

import java.util.UUID;

/**
 * Peer presence over a custom payload channel: on join, announce "I'm on Omega" (own UUID); when
 * an announcement arrives, remember that UUID for the nametag badge. Plain vanilla servers ignore
 * unknown serverbound channels and never send clientbound ones, so this is silently dormant there
 * - it lights up on servers/proxies running a relay for the channel. That's the honest ceiling of
 * a backend-less design: a client cannot know what software another client runs unless something
 * (server relay today, hosted presence API someday) tells it. See OmegaPresence in common/.
 */
public final class PresenceNetworking {
    public static final Identifier CHANNEL = new Identifier("omega-client", "presence");

    private PresenceNetworking() {
    }

    public static void register(ModConfig config) {
        ClientPlayNetworking.registerGlobalReceiver(CHANNEL, (client, handler, buf, responseSender) -> {
            UUID uuid = buf.readUuid();
            // The three per-slot cosmetic ids ride alongside the UUID - both ends of this channel are
            // always the same mod version by construction (Omega only ever talks to Omega), so no
            // wire-compat concern.
            OmegaPresence.CosmeticSet set = new OmegaPresence.CosmeticSet(buf.readString(), buf.readString(), buf.readString());
            client.execute(() -> OmegaPresence.add(uuid, set));
        });

        ClientPlayConnectionEvents.JOIN.register((handler, sender, client) -> {
            if (!config.showOmegaUsersEnabled || client.player == null) return;
            OmegaPresence.add(client.player.getUuid(), new OmegaPresence.CosmeticSet(config.activeHatId, config.activeCapeId, config.activeWingsId));
            PacketByteBuf buf = new PacketByteBuf(Unpooled.buffer());
            buf.writeUuid(client.player.getUuid());
            buf.writeString(config.activeHatId);
            buf.writeString(config.activeCapeId);
            buf.writeString(config.activeWingsId);
            sender.sendPacket(CHANNEL, buf);
        });

        ClientPlayConnectionEvents.DISCONNECT.register((handler, client) -> OmegaPresence.clear());
    }
}
