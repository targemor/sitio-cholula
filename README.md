# Astro Starter Kit: Basics

```sh
npm create astro@latest -- --template basics
```

> 🧑‍🚀 **Seasoned astronaut?** Delete this file. Have fun!

## 🚀 Project Structure

Inside of your Astro project, you'll see the following folders and files:

```text
/
├── public/
│   └── favicon.svg
├── src
│   ├── assets
│   │   └── astro.svg
│   ├── components
│   │   └── Welcome.astro
│   ├── layouts
│   │   └── Layout.astro
│   └── pages
│       └── index.astro
└── package.json
```

To learn more about the folder structure of an Astro project, refer to [our guide on project structure](https://docs.astro.build/en/basics/project-structure/).

## 🧞 Commands

All commands are run from the root of the project, from a terminal:

| Command                   | Action                                           |
| :------------------------ | :----------------------------------------------- |
| `npm install`             | Installs dependencies                            |
| `npm run dev`             | Starts local dev server at `localhost:4321`      |
| `npm run build`           | Build your production site to `./dist/`          |
| `npm run preview`         | Preview your build locally, before deploying     |
| `npm run astro ...`       | Run CLI commands like `astro add`, `astro check` |
| `npm run astro -- --help` | Get help using the Astro CLI                     |

## 👀 Want to learn more?

Feel free to check [our documentation](https://docs.astro.build) or jump into our [Discord server](https://astro.build/chat).

## 🚀 Deploy

El sitio se publica **solo desde GitHub Actions**. El workflow
[`.github/workflows/wp-extract.yml`](.github/workflows/wp-extract.yml) extrae los datos
de WordPress, descarga y convierte las imagenes, hace el build y sube a S3 +
CloudFront (`scripts/deploy.sh`).

Como lanzarlo:

- **Manual:** pestana *Actions* -> *WordPress Data Extract* -> *Run workflow*.
- **Automatico:** el `repository_dispatch` con el evento `wordpress_update`,
  que dispara WordPress al actualizar contenido.

`scripts/deploy.sh` aborta si no corre dentro del runner y `scripts/deploy.ps1`
esta desactivado: los deploys desde una maquina local suben builds con datos e
imagenes que pueden no coincidir con los del runner, y el sync usa `--delete`
sobre el bucket. Para una emergencia existe `bash scripts/deploy.sh --allow-local`.
