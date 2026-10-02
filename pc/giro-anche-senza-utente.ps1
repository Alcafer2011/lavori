# Da lanciare UNA volta come amministratore (tasto destro > Esegui con PowerShell come amministratore):
# il giro degli originali parte anche quando nessuno e' entrato nel PC (come il server dei Funghi).
$t = Get-ScheduledTask -TaskName 'Lavori - originali sul PC'
$t.Principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType S4U
Set-ScheduledTask -InputObject $t | Out-Null
"Fatto: $((Get-ScheduledTask -TaskName 'Lavori - originali sul PC').Principal.LogonType)"
Read-Host 'Premi Invio per chiudere'
