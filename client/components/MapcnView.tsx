import React, { useRef, useEffect, useState } from 'react';
import { View, StyleSheet, ViewStyle, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import { Accelerometer } from 'expo-sensors';

export interface MapcnViewProps {
  style?: ViewStyle | ViewStyle[];
  center?: [number, number]; // [longitude, latitude]
  zoom?: number;
  theme?: 'light' | 'dark';
  markers?: { id?: string; coordinate: [number, number]; color?: string; icon?: string }[];
  showsUserLocation?: boolean;
  onInteract?: (active: boolean) => void;
  onMarkerPress?: (markerId: string) => void;
  fitToMarkersAndUser?: boolean;
  disableShakeToFly?: boolean;
}

export function MapcnView({
  style,
  center,
  zoom = 11,
  theme = 'light',
  markers = [],
  showsUserLocation = false,
  onInteract,
  onMarkerPress,
  fitToMarkersAndUser = false,
  disableShakeToFly = false
}: MapcnViewProps) {
  const webViewRef = useRef<WebView>(null);
  const [currentLoc, setCurrentLoc] = useState<[number, number] | null>(null);

  useEffect(() => {
    if (showsUserLocation) {
      (async () => {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          let location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          setCurrentLoc([location.coords.longitude, location.coords.latitude]);
        }
      })();
    }
  }, [showsUserLocation]);

  // Shake detection to recenter
  useEffect(() => {
    let subscription: any;
    let lastUpdate = 0;
    let last_x = 0, last_y = 0, last_z = 0;
    const SHAKE_THRESHOLD = 800;

    if (showsUserLocation && currentLoc && Platform.OS !== 'web' && !disableShakeToFly) {
      Accelerometer.setUpdateInterval(100);
      subscription = Accelerometer.addListener(accelerometerData => {
        let curTime = Date.now();
        if ((curTime - lastUpdate) > 100) {
          let diffTime = (curTime - lastUpdate);
          lastUpdate = curTime;
          let { x, y, z } = accelerometerData;

          let speed = Math.abs(x + y + z - last_x - last_y - last_z) / diffTime * 10000;

          if (speed > SHAKE_THRESHOLD) {
            // Shake detected! Fly to user location.
            if (webViewRef.current) {
              webViewRef.current.injectJavaScript(`
                  if (typeof map !== 'undefined') {
                     map.flyTo({ center: [${currentLoc[0]}, ${currentLoc[1]}], zoom: 14 });
                  }
                  true;
               `);
            }
          }
          last_x = x;
          last_y = y;
          last_z = z;
        }
      });
    }

    return () => {
      if (subscription) subscription.remove();
    };
  }, [showsUserLocation, currentLoc, disableShakeToFly]);

  const mapStyleUrl = theme === 'dark'
    ? 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
    : 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';

  const markersJson = JSON.stringify(markers);
  const currentLocJson = JSON.stringify(currentLoc);

  // Inject props into the webview when they change
  useEffect(() => {
    if (webViewRef.current) {
      const effectiveCenter = center || currentLoc || (markers.length > 0 ? markers[0].coordinate : [-74.006, 40.7128]);

      const message = {
        type: 'update',
        center: effectiveCenter,
        zoom,
        theme,
        mapStyleUrl,
        markers,
        userLoc: showsUserLocation ? currentLoc : null,
        fitToMarkersAndUser
      };

      // Send message to the window inside the webview
      webViewRef.current.injectJavaScript(`
        window.postMessage(${JSON.stringify(message)}, '*');
        true;
      `);
    }
  }, [center, zoom, theme, mapStyleUrl, markersJson, currentLocJson, showsUserLocation, fitToMarkersAndUser, disableShakeToFly]);

  const initialCenter = center || currentLoc || (markers.length > 0 ? markers[0].coordinate : [-74.006, 40.7128]);
  const initialUserLoc = showsUserLocation ? currentLoc : null;

  const [html] = useState(() => {
    // We now rely on the parent components to wait for valid location props before mounting this component.
    // However, as an ultimate fallback, default to [0, 0] instead of New York if somehow nothing is passed.
    const initC = center || currentLoc || (markers.length > 0 ? markers[0].coordinate : [0, 0]);
    const initUserLoc = showsUserLocation ? currentLoc : null;

    return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="initial-scale=1,maximum-scale=1,user-scalable=no" />
        <script src="https://cdn.tailwindcss.com"></script>
        <script src="https://unpkg.com/feather-icons"></script>
        <script src="https://unpkg.com/maplibre-gl@4.1.3/dist/maplibre-gl.js"></script>
        <link href="https://unpkg.com/maplibre-gl@4.1.3/dist/maplibre-gl.css" rel="stylesheet" />
        <style>
          body, html { margin: 0; padding: 0; height: 100%; width: 100%; overflow: hidden; background: transparent; }
          #map { width: 100%; height: 100%; }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script>
          const map = new maplibregl.Map({
            container: 'map',
            style: '${mapStyleUrl}',
            center: [${initC[0]}, ${initC[1]}],
            zoom: ${zoom},
            attributionControl: false,
          });
          
          map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
          
          window.__currentMapStyle = '${mapStyleUrl}';
          let currentMarkers = [];
          let userLocMarker = null;
          let currentUserLoc = ${JSON.stringify(initialUserLoc)};
          
          function clearMarkers() {
             currentMarkers.forEach(m => m.remove());
             currentMarkers = [];
             if (userLocMarker) {
                 userLocMarker.remove();
                 userLocMarker = null;
             }
          }
          
          function renderMarkers(markers, userLoc) {
            clearMarkers();
            currentUserLoc = userLoc;
            
            markers.forEach(m => {
              const el = document.createElement('div');
              el.className = 'rounded-full border-2 border-white shadow-md flex items-center justify-center';
              el.style.cursor = 'pointer';
              
              if (m.icon) {
                 el.style.width = '32px';
                 el.style.height = '32px';
                 el.style.backgroundColor = m.color || ( '${theme}' === 'dark' ? '#3b82f6' : '#2563eb' );
                 el.innerHTML = '<i data-feather="' + m.icon + '" style="color: white; width: 16px; height: 16px;"></i>';
              } else {
                 el.style.width = '16px';
                 el.style.height = '16px';
                 el.style.backgroundColor = m.color || ( '${theme}' === 'dark' ? '#3b82f6' : '#2563eb' );
              }
              
              el.addEventListener('click', function(e) {
                e.stopPropagation();
                if (m.id && window.ReactNativeWebView) {
                  window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'markerPress', markerId: m.id }));
                }
              });
              
              const marker = new maplibregl.Marker({ element: el })
                .setLngLat([m.coordinate[0], m.coordinate[1]])
                .addTo(map);
                
              currentMarkers.push(marker);
            });
            
            if (userLoc) {
              const userEl = document.createElement('div');
              userEl.className = 'w-5 h-5 rounded-full border-2 border-white shadow-md relative flex items-center justify-center';
              userEl.style.backgroundColor = '#3b82f6';
              userEl.innerHTML = '<div class="absolute w-full h-full rounded-full bg-blue-500 animate-ping opacity-75"></div><div class="w-2 h-2 rounded-full bg-white z-10"></div>';

              userLocMarker = new maplibregl.Marker({ element: userEl })
                .setLngLat([userLoc[0], userLoc[1]])
                .addTo(map);
            }
            
            if (typeof feather !== 'undefined') {
              feather.replace();
            }
          }
          
          // Initial markers
          renderMarkers(${JSON.stringify(markers)}, currentUserLoc);
          
          map.on('load', () => {
             if (${!!fitToMarkersAndUser} && ${markers.length} > 0 && currentUserLoc) {
                 const bounds = new maplibregl.LngLatBounds();
                 bounds.extend([currentUserLoc[0], currentUserLoc[1]]);
                 const markersData = ${JSON.stringify(markers)};
                 markersData.forEach(m => bounds.extend([m.coordinate[0], m.coordinate[1]]));
                 map.fitBounds(bounds, { padding: 100, maxZoom: 14 });
             }
          });
          
          // Listen for updates from React Native
          window.addEventListener('message', (event) => {
             try {
                let data = event.data;
                if (typeof data === 'string') {
                   data = JSON.parse(data);
                }
                
                if (data && data.type === 'update') {
                   if (data.fitToMarkersAndUser && data.markers && data.markers.length > 0 && data.userLoc) {
                       const bounds = new maplibregl.LngLatBounds();
                       bounds.extend([data.userLoc[0], data.userLoc[1]]);
                       data.markers.forEach(m => bounds.extend([m.coordinate[0], m.coordinate[1]]));
                       map.fitBounds(bounds, { padding: 100, maxZoom: 14 });
                   } else {
                       map.flyTo({ center: [data.center[0], data.center[1]], zoom: data.zoom });
                   }
                   if (window.__currentMapStyle !== data.mapStyleUrl) {
                       window.__currentMapStyle = data.mapStyleUrl;
                       map.setStyle(data.mapStyleUrl);
                   }
                   renderMarkers(data.markers, data.userLoc);
                }
             } catch (e) {
                console.error('Error handling message from React Native', e);
             }
          });
          
          // Document message listener (for some RN WebView implementations)
          document.addEventListener('message', (event) => {
             window.dispatchEvent(new MessageEvent('message', { data: event.data }));
          });

          // Tell RN when map interaction starts/ends
          map.on('touchstart', () => {
             window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'interaction', active: true }));
          });
          map.on('touchend', () => {
             window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'interaction', active: false }));
          });
          map.on('touchcancel', () => {
             window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'interaction', active: false }));
          });
        </script>
      </body>
    </html>
  `;
  });

  return (
      <View style={[styles.container, style]}>
        <WebView
          ref={webViewRef}
          source={{ html }}
          style={styles.webview}
          scrollEnabled={false}
          nestedScrollEnabled={true}
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          onMessage={(event) => {
            try {
              const data = JSON.parse(event.nativeEvent.data);
              if (data.type === 'interaction' && onInteract) {
                onInteract(data.active);
              }
              if (data.type === 'markerPress' && onMarkerPress) {
                onMarkerPress(data.markerId);
              }
            } catch (e) { }
          }}
        />
      </View>
    );
  }

const styles = StyleSheet.create({
    container: {
      flex: 1,
      overflow: 'hidden',
    },
    webview: {
      flex: 1,
      backgroundColor: 'transparent',
    }
  });
