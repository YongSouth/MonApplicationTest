function afterInstall() {
  // Compléments à l'installation
  console.log('Recopie des scénarios');
  let src = 'C:\\Program Files\\SKV2-Borne\\SKRestAPI\\wwwroot\\monApplicationTest\\scenarios\\';
  let dst = scriptPath.SoftKioskScriptsPath() + '\\scenarios\\';
  let scn1 = 'monApplicationTest_BarcodeReading.json';
  let scn2 = 'monApplicationTest_CardPayment.json'
  file.Move(src + scn1, dst + scn1, true);
  file.Move(src + scn2, dst + scn2, true);
}

function createXml() {
  return `
<application name="monApplicationTest">
  <property name="param">http://localhost:5000/monApplicationTest/application/index.html</property>
  <property name="splashUrl">http://localhost:5000/softkiosk/splash.html</property>
  <property name="errorUrl">http://localhost:5000/monApplicationTest/error/error.html</property>
  <property name="screenSaverUrl">http://localhost:5000/softkiosk/screensaver.html</property>
  <property name="startDelay">30</property>
  <phase name="EXPL" subPhase="" code="757fb4dd4f4f986603c8b316867285bc" autologon="true">
    <flags>
      <flag name="AppManual">true</flag>
    </flags>
    <services>
      <!-- SoftKiosk obligatoire -->
      <service name="PanelPC" />
      <service name="Network" />
      <service name="Signaling" />
  
      <!-- Session, inactivité à configurer -->
     	<service name="Session">
       	<property name="Marker">600,10</property>
     	</service>
      
      <!-- Services utilisés par l'application -->
     	<service name="OnscreenKbd" />
     	<service name="BarcodeReading"/>
      <service name="ReceiptPrinting"/>
      <service name="TicketPrinting"/>
      <service name="CardPayment"/>
      <service name="CashPayment"/>
   </services>
  </phase>
</application>    
`;
}