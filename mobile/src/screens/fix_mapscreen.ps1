$path = 'mobile/src/screens/MapScreen.js'
$content = Get-Content $path -Raw
$search = '<Ionicons name="heart" size={16} color={COLORS.primary} />\s+<Text style={styles.statVal}>{selectedAnimal.heart_rate \|\| ''—''}</Text>.*<Modal'
$replace = '<Ionicons name="heart" size={16} color={COLORS.primary} />
                <Text style={styles.statVal}>{selectedAnimal.heart_rate || "—"}</Text>
                <Text style={styles.statLab}>BPM</Text>
              </View>
              <View style={styles.statCard}>
                <Ionicons name="battery-dead" size={16} color={COLORS.success} />
                <Text style={styles.statVal}>{selectedAnimal.battery_level || "—"}%</Text>
                <Text style={styles.statLab}>Batterie</Text>
              </View>
            </View>
          )}
        </View>
      )}

      <Modal'

$content = $content -replace $search, $replace
[IO.File]::WriteAllText($path, $content, [System.Text.Encoding]::UTF8)
