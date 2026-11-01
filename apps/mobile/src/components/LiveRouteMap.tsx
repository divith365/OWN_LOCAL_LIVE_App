import React, { useMemo } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Linking, Platform } from 'react-native';
import { WebView } from 'react-native-webview';

interface LiveRouteMapProps {
  merchantLat?: number | null;
  merchantLng?: number | null;
  merchantName?: string;
  riderLat?: number | null;
  riderLng?: number | null;
  riderName?: string;
  customerLat?: number | null;
  customerLng?: number | null;
  customerAddress?: string;
  orderStatus?: string;
}

export function LiveRouteMap({
  merchantLat = 15.9587,
  merchantLng = 76.1264,
  merchantName = 'Merchant Store',
  riderLat,
  riderLng,
  riderName = 'Delivery Partner',
  customerLat = 15.9602,
  customerLng = 76.1298,
  customerAddress = 'Delivery Destination',
  orderStatus,
}: LiveRouteMapProps) {
  const mLat = merchantLat || 15.9587;
  const mLng = merchantLng || 76.1264;
  const cLat = customerLat || 15.9602;
  const cLng = customerLng || 76.1298;
  const rLat = riderLat || (mLat + cLat) / 2;
  const rLng = riderLng || (mLng + cLng) / 2;
  const hasRider = Boolean(riderLat && riderLng);

  // Calculate distance between rider (or store) and customer in km
  const distanceKm = useMemo(() => {
    const lat1 = hasRider ? rLat : mLat;
    const lon1 = hasRider ? rLng : mLng;
    const R = 6371; // Earth radius in km
    const dLat = ((cLat - lat1) * Math.PI) / 180;
    const dLon = ((cLng - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((cLat * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return (R * c).toFixed(1);
  }, [mLat, mLng, cLat, cLng, rLat, rLng, hasRider]);

  const handleOpenGoogleMaps = () => {
    const targetLat = hasRider ? rLat : mLat;
    const targetLng = hasRider ? rLng : mLng;
    const dest = `${cLat},${cLng}`;
    const url = Platform.select({
      ios: `maps:0,0?q=${dest}`,
      android: `google.navigation:q=${dest}&mode=d`,
      default: `https://www.google.com/maps/dir/?api=1&origin=${targetLat},${targetLng}&destination=${dest}&travelmode=driving`,
    });
    Linking.openURL(url).catch(() => {
      Linking.openURL(
        `https://www.google.com/maps/dir/?api=1&origin=${targetLat},${targetLng}&destination=${dest}&travelmode=driving`
      );
    });
  };

  // Generate Leaflet OpenStreetMap HTML
  const mapHtml = useMemo(() => {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          html, body, #map { width: 100%; height: 100%; background: #f8fafc; font-family: -apple-system, sans-serif; }
          .custom-div-icon {
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .marker-pin {
            width: 36px;
            height: 36px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 18px;
            box-shadow: 0 4px 10px rgba(0,0,0,0.25);
            border: 2px solid #ffffff;
          }
          .store-pin { background: #0284c7; }
          .customer-pin { background: #16a34a; }
          .rider-pin {
            background: #ff8a16;
            animation: pulse 1.8s infinite;
          }
          @keyframes pulse {
            0% { box-shadow: 0 0 0 0 rgba(255, 138, 22, 0.6); }
            70% { box-shadow: 0 0 0 14px rgba(255, 138, 22, 0); }
            100% { box-shadow: 0 0 0 0 rgba(255, 138, 22, 0); }
          }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script>
          const map = L.map('map', {
            zoomControl: false,
            attributionControl: false
          });

          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19
          }).addTo(map);

          const storeIcon = L.divIcon({
            className: 'custom-div-icon',
            html: '<div class="marker-pin store-pin">🏪</div>',
            iconSize: [36, 36],
            iconAnchor: [18, 18]
          });

          const customerIcon = L.divIcon({
            className: 'custom-div-icon',
            html: '<div class="marker-pin customer-pin">📍</div>',
            iconSize: [36, 36],
            iconAnchor: [18, 18]
          });

          const riderIcon = L.divIcon({
            className: 'custom-div-icon',
            html: '<div class="marker-pin rider-pin">🛵</div>',
            iconSize: [36, 36],
            iconAnchor: [18, 18]
          });

          const storeMarker = L.marker([${mLat}, ${mLng}], { icon: storeIcon })
            .addTo(map)
            .bindPopup('<b>Store:</b> ${merchantName.replace(/'/g, "\\'")}');

          const customerMarker = L.marker([${cLat}, ${cLng}], { icon: customerIcon })
            .addTo(map)
            .bindPopup('<b>Destination:</b> ${customerAddress.replace(/'/g, "\\'")}');

          const points = [[${mLat}, ${mLng}]];

          ${
            hasRider
              ? `
            const riderMarker = L.marker([${rLat}, ${rLng}], { icon: riderIcon })
              .addTo(map)
              .bindPopup('<b>Rider:</b> ${riderName.replace(/'/g, "\\'")}');
            points.push([${rLat}, ${rLng}]);
          `
              : ''
          }

          points.push([${cLat}, ${cLng}]);

          const polyline = L.polyline(points, {
            color: '#ff8a16',
            weight: 4,
            opacity: 0.85,
            dashArray: '8, 8'
          }).addTo(map);

          const bounds = L.latLngBounds(points);
          map.fitBounds(bounds, { padding: [35, 35] });
        </script>
      </body>
      </html>
    `;
  }, [mLat, mLng, cLat, cLng, rLat, rLng, hasRider, merchantName, customerAddress, riderName]);

  return (
    <View style={styles.cardContainer}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>🗺️ Live OpenStreetMap Route</Text>
          <Text style={styles.subtitle}>
            {hasRider
              ? `Rider active • ${distanceKm} km to doorstep`
              : `Order being processed • Store to delivery point (${distanceKm} km)`}
          </Text>
        </View>
        <View style={styles.liveBadge}>
          <View style={styles.pulseDot} />
          <Text style={styles.liveText}>OSM LIVE</Text>
        </View>
      </View>

      {/* Embedded Leaflet OpenStreetMap Canvas */}
      <View style={styles.mapWrapper}>
        <WebView
          originWhitelist={['*']}
          source={{ html: mapHtml }}
          style={styles.webView}
          scrollEnabled={false}
          javaScriptEnabled={true}
          domStorageEnabled={true}
        />
      </View>

      {/* Navigation & Telemetry Footer */}
      <View style={styles.telemetryFooter}>
        <View style={styles.telemetryInfo}>
          <Text style={styles.telemetryMetric}>{distanceKm} km</Text>
          <Text style={styles.telemetryLabel}>Distance Remaining</Text>
        </View>
        <TouchableOpacity style={styles.navButton} onPress={handleOpenGoogleMaps}>
          <Text style={styles.navIcon}>🧭</Text>
          <Text style={styles.navButtonText}>Turn-by-Turn Nav</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  subtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ef4444',
    marginRight: 6,
  },
  liveText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#b91c1c',
  },
  mapWrapper: {
    width: '100%',
    height: 220,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#f1f5f9',
  },
  webView: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  telemetryFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  telemetryInfo: {
    flex: 1,
  },
  telemetryMetric: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ff8a16',
  },
  telemetryLabel: {
    fontSize: 11,
    color: '#64748b',
  },
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0284c7',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  navIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  navButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
});
