// swift-tools-version: 5.9

import PackageDescription

let package = Package(
    name: "TokenCat",
    defaultLocalization: "en",
    platforms: [.macOS(.v14)],
    products: [
        .executable(name: "TokenCat", targets: ["TokenCat"]),
    ],
    targets: [
        .executableTarget(
            name: "TokenCat",
            path: "Sources/TokenCat",
            resources: [
                .process("Resources"),
            ],
            linkerSettings: [
                .unsafeFlags([
                    "-Xlinker", "-sectcreate",
                    "-Xlinker", "__TEXT",
                    "-Xlinker", "__info_plist",
                    "-Xlinker", "Resources/Info.plist",
                ])
            ]
        ),
    ]
)
