$path = 'mobile/src/screens/MapScreen.js'
$lines = Get-Content $path
$newLines = New-Object System.Collections.Generic.List[string]

$inBadSection = $false
foreach ($line in $lines) {
    if ($line -like '*<Ionicons name="heart"*') {
        $inBadSection = $true
        $newLines.Add('                <Ionicons name="heart" size={16} color={COLORS.primary} />')
        $newLines.Add('                <Text style={styles.statVal}>{selectedAnimal.heart_rate || "—"}</Text>')
        $newLines.Add('                <Text style={styles.statLab}>BPM</Text>')
        $newLines.Add('              </View>')
        $newLines.Add('              <View style={styles.statCard}>')
        $newLines.Add('                <Ionicons name="battery-dead" size={16} color={COLORS.success} />')
        $newLines.Add('                <Text style={styles.statVal}>{selectedAnimal.battery_level || "—"}%</Text>')
        $newLines.Add('                <Text style={styles.statLab}>Batterie</Text>')
        $newLines.Add('              </View>')
        $newLines.Add('            </View>')
        $newLines.Add('          )}')
        $newLines.Add('        </View>')
        $newLines.Add('      )}')
        continue
    }
    
    if ($inBadSection) {
        if ($line -like '*<Modal*') {
            $inBadSection = $false
            $newLines.Add('      <Modal')
        }
        continue
    }
    
    $newLines.Add($line)
}

[IO.File]::WriteAllLines($path, $newLines, [System.Text.Encoding]::UTF8)
