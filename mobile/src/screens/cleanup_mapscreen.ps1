$path = 'mobile/src/screens/MapScreen.js'
$content = [IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)
$content = $content -replace '|| ''\?.*''', '|| "—"'
$content = $content -replace 'p.rim.tres', 'périmètres'
[IO.File]::WriteAllText($path, $content, [System.Text.Encoding]::UTF8)
