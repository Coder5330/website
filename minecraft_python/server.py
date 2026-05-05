from multiplayer import MultiplayerServer, build_server_arg_parser


def main():
    parser = build_server_arg_parser()
    args = parser.parse_args()
    server = MultiplayerServer(host=args.host, port=args.port, seed=args.seed)
    server.serve_forever()


if __name__ == '__main__':
    main()
