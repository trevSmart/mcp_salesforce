# Configuració de Jupyter per al projecte MCP Salesforce

# Configuració del servidor
c.ServerApp.ip = 'localhost'
c.ServerApp.port = 8888
c.ServerApp.open_browser = False
c.ServerApp.allow_root = False

# Configuració de seguretat
c.ServerApp.token = ''
c.ServerApp.password = ''
c.ServerApp.allow_origin = '*'

# Configuració de kernels
c.ServerApp.kernel_spec_manager_class = 'jupyter_client.kernelspec.KernelSpecManager'

# Configuració de fitxers
c.ServerApp.root_dir = '.'
c.ServerApp.notebook_dir = '.'

# Configuració de extensions
c.ServerApp.enable_mathjax = True
c.ServerApp.enable_mathjax_cdn = True

# Configuració de timeout
c.ServerApp.shutdown_no_activity_timeout = 0
c.ServerApp.terminado_settings = {'shell_command': ['/bin/bash']}

# Configuració de logging
c.Application.log_level = 'INFO'
c.ServerApp.log_level = 'INFO'

# Configuració de CORS (per a desenvolupament)
c.ServerApp.allow_credentials = True
c.ServerApp.allow_headers = ['*']

print("✅ Configuració de Jupyter carregada per al projecte MCP Salesforce")
print("🌐 Servidor configurat per a executar-se a: http://localhost:8888")
print("📁 Directori de treball: notebooks/")
print("🔧 Kernel personalitzat: MCP Salesforce")
