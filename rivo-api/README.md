# rivo-api

API serverless en Go, desplegada como funciones Lambda (AWS) mediante Terraform.

## Estructura del proyecto

```
rivo-api/
  main.tf, variable.tf, provider.tf, backend.tf   # raíz de Terraform, registra cada lambda como módulo
  infraestructure/                                 # módulos de Terraform (lambda/golang, dynamoDB, api, ...)
  environments/                                    # .tfvars por ambiente (local, etc.)
  Makefile
  src/
    go.work            # workspace de Go — SOLO local, está en .gitignore, no se versiona
    shared/             # módulo Go compartido entre lambdas (no se despliega solo)
      go.mod
      models/            # structs de dominio (ej. project.Project)
      errors/          # tipo de error de aplicación + mapeo a respuestas HTTP
      repository/         # implementaciones concretas de acceso a datos (ej. DynamoDB)
    ping/                # una lambda = un módulo Go independiente
      go.mod
      main.go
    project/
      create-project/
        go.mod
        main.go
      get-project/
        go.mod
        main.go
    build/               # zips generados por Terraform al hacer build — en .gitignore
```

Cada lambda es su **propio módulo de Go** (su propio `go.mod`), no un paquete dentro de un módulo grande. `shared` es otro módulo Go más, independiente, que las lambdas consumen como dependencia local (ver sección de `replace` más abajo).

## `go.work`: por qué existe y por qué no se sube a git

`src/go.work` le dice a tu editor (gopls) "todos estos módulos, aunque sean independientes, trátalos como si fueran uno solo mientras yo los edito" — así puedes navegar entre `shared` y una lambda, tener autocompletado cruzado, etc. **Está en `.gitignore`** a propósito: es un archivo de conveniencia local, no algo que el build de producción (Terraform) necesite ni lea.

Consecuencia importante: **todo lo que haga que el build funcione tiene que estar en el `go.mod` de cada lambda, no solo en `go.work`**, porque en un clone nuevo del repo (o en CI) `go.work` no va a existir.

Cuando crees un módulo nuevo, agrégalo también a tu `go.work` local para comodidad del editor:
```
use (
    ./ping
    ./project/create-project
    ./project/get-project
    ./shared
    ./tu-nuevo-modulo   # <-- agregar aquí
)
```

## El paquete `shared`

- `shared/models/<dominio>/`: structs de dominio con tags (`dynamodbav`, `json`, etc). Ej: `models/project/project.go`.
- `shared/errors/`: tipo `ApiError` (implementa `error`, con `Code`, `Message`, `StatusCode`, `Err`) + constructores (`NotFound`, `Validation`, `Internal`). Es deliberadamente agnóstico de transporte — no importa `events` ni sabe que existe API Gateway, para poder reusarse detrás de cualquier adaptador conductor futuro (SQS, EventBridge, etc).
- `shared/transport/apigateway/`: el serializador específico de la integración proxy de API Gateway — `Error(err) events.APIGatewayProxyResponse` traduce un `ApiError` a la respuesta HTTP consistente, `Success(statusCode, body)` hace lo mismo para el camino feliz (mismo shape de JSON y mismo header `Content-Type` en todas las lambdas). Vive fuera de `shared/errors` a propósito: no es parte del dominio del error, es la vista de un adaptador conductor concreto sobre él. `transport/` es el paquete padre a propósito, aunque hoy solo tenga `apigateway` adentro, para que un futuro `transport/sqs` o `transport/eventbridge` no requiera reacomodar nada.
- `shared/repository/`: implementaciones concretas contra una fuente de datos real — hoy `DynamoDBProjectRepository`, con `GetByID`, `Create`, `Update`, `Delete`, `List` — para que los handlers no hablen directo con el SDK de AWS. Un solo tipo concreto satisface varios puertos chicos a la vez (uno por lambda que lo consume).

**Las interfaces (`ProjectGetter`, `ProjectCreator`, etc.) se declaran en cada lambda, no en `shared`** — cada handler pide solo los métodos que usa, y el tipo concreto en `repository` los satisface implícitamente sin que `shared` sepa que esas interfaces existen. Esto es idiomático en Go: "el consumidor define el contrato".

Como `shared` es el mismo módulo para todas sus subcarpetas, agregar un paquete nuevo (`transport/apigateway`, `repository`, otro dominio en `models`) **no requiere tocar el `go.mod` de las lambdas que ya dependen de `shared`** — solo agregas el import:
```go
import "github.com/rivo-api/shared/errors"
import "github.com/rivo-api/shared/transport/apigateway"
```

## Cómo crea Terraform el build de una lambda (para entender qué pasa "por debajo")

Cada lambda se registra en la raíz `main.tf` como un módulo:
```hcl
module "lambda_get_project" {
  source              = "./infraestructure/lambda/golang"
  function_name       = "get-project"
  path_directory_file = "project/get-project/main.go"
  ...
}
```

El módulo `infraestructure/lambda/golang` (ver `main.tf` ahí) corre, en cada `plan`/`apply`, este script (`local-exec`):
```bash
cd src/<carpeta de la lambda>
if [ ! -f go.mod ]; then go mod init <function_name>; fi
go mod tidy
GOOS=linux GOARCH=arm64 CGO_ENABLED=0 go build -o bootstrap .
```
y después empaqueta `bootstrap` en `src/build/<function_name>.zip`, que es lo que sube a Lambda (runtime `provided.al2023`, arquitectura `arm64` — el `aws_lambda_function` tiene `architectures = ["arm64"]`, tiene que coincidir siempre con el `GOARCH` del build).

Esto explica dos cosas clave:
1. **Terraform puede crear el `go.mod` por ti** si no existe (usando `function_name` como nombre del módulo) — pero conviene que tú lo crees antes, para tener soporte del editor sin depender de correr Terraform primero.
2. **El build de Terraform corre sin `go.work`** (porque no está en git) y desde dentro de la carpeta de la lambda — por eso el `replace` en el `go.mod` de cada lambda es indispensable, no opcional: es lo único que le permite a `go build` encontrar `shared` en disco, tanto a Terraform como a cualquiera que clone el repo.

## Checklist: cómo crear una lambda nueva

1. **Crear la carpeta y el archivo**: `src/<área>/<nombre-lambda>/main.go`.

2. **Inicializar el módulo Go** (dentro de esa carpeta):
   ```bash
   go mod init <nombre-lambda>
   ```
   Usa el mismo nombre corto que usas como `function_name` en Terraform (así lo hacen `ping`, `create-project`, `get-project` — no uses un path largo tipo `github.com/...`, porque estas lambdas nunca se importan desde otro lado, son binarios finales).

3. **Agregar la carpeta a tu `go.work` local** (no se sube a git, es solo para tu editor):
   ```
   use (
       ...
       ./<área>/<nombre-lambda>
   )
   ```

4. **Si la lambda necesita `shared`**, agrega a mano en su `go.mod`:
   ```
   require github.com/rivo-api/shared v0.0.0

   replace github.com/rivo-api/shared => ../../shared
   ```
   Ajusta el número de `../` según la profundidad real de la carpeta (ej. `project/create-project` usa `../../shared`; si tu lambda vive un nivel más profundo, necesitas un `../` extra).

5. **Escribe el handler.** Importa lo que necesites (`shared/models/...`, `shared/apperrors`, `shared/repository`, SDKs de AWS, etc).

6. **Corre `go mod tidy` dentro de la carpeta de la lambda.**
   - No necesitas correr `go get <paquete>` casi nunca: `go mod tidy` detecta los imports que usa tu código y agrega/fija versiones automáticamente, además de limpiar los que ya no uses.
   - Usa `go get <paquete>@<version>` solo si quieres forzar una versión específica de una dependencia nueva (caso raro).
   - Terraform también corre `go mod tidy` en cada build (ver arriba), así que aunque se te olvide, se va a correr antes de desplegar — pero conviene correrlo tú antes, para que tu editor y `go build` local ya reflejen el estado real.

7. **Verifica localmente antes de tocar Terraform:**
   ```bash
   cd src/<área>/<nombre-lambda>
   go build -o /dev/null .    # chequeo rápido de que compila, sin dejar un binario suelto
   # o, para replicar exactamente lo que hará Terraform:
   GOOS=linux GOARCH=arm64 CGO_ENABLED=0 go build -o bootstrap .
   ```

8. **Registra la lambda en la raíz `main.tf`:**
   ```hcl
   module "lambda_<nombre>" {
     source              = "./infraestructure/lambda/golang"
     function_name       = "<nombre-lambda>"
     path_directory_file = "<área>/<nombre-lambda>/main.go"
     project_name        = var.project_name
     environment         = var.environment

     environment_variables = { ... }   # si aplica
     statement = [ ... ]               # permisos IAM que necesite (dynamodb:GetItem, etc.)
   }
   ```

9. **`make plan` / `make deploy`** — acá es cuando Terraform de verdad compila y empaqueta el binario.

## Formateo de código Go

`make fmt-go` corre `gofmt` sobre todos los `.go` bajo `src/`. Nota: `gofmt` solo ordena espacios/indentación/estilo — **no puede formatear un archivo con errores de sintaxis** (por eso si guardas y no formatea, primero revisa si el archivo compila). Tampoco organiza imports (agregar/quitar automáticamente) — si más adelante quieres eso, se instala `goimports` (`go install golang.org/x/tools/cmd/goimports@latest`) y se cambia el comando del target.

## Seguridad — pendiente conocido

La API (`ping`, `POST /projects`, `GET /projects/{id}`) se despliega hoy **sin ningún tipo de autenticación** (`authorization = "NONE"` en `infraestructure/api/api-method/variables.tf`, nunca sobreescrito). Es una decisión consciente para esta etapa del proyecto, no un descuido — pero antes de que esto reciba tráfico real o datos que importen, hay que agregar como mínimo una API key (usage plan de API Gateway) o un authorizer real (Cognito/JWT) según quién vaya a consumir la API.
